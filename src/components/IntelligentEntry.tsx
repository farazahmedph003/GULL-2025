import React, { useState, useRef } from 'react';
import type { EntryType } from '../types';
import { isValidNumber, formatCurrency } from '../utils/helpers';
import { useUserBalance } from '../hooks/useUserBalance';
import { useTransactions } from '../hooks/useTransactions';
import { useAuth } from '../contexts/AuthContext';
import { isAdminEmail } from '../config/admin';
import { useNotifications } from '../contexts/NotificationContext';
import JSZip from 'jszip';

interface IntelligentEntryProps {
  projectId: string;
  entryType: EntryType;
  onSuccess: () => void;
}

interface ParsedEntry {
  number: string;
  first: number;
  second: number;
  entryType: EntryType; // Auto-detected from number length
}

const IntelligentEntry: React.FC<IntelligentEntryProps> = ({
  projectId,
  entryType: _entryType,
  onSuccess,
}) => {
  const { user } = useAuth();
  const { balance, hasSufficientBalance } = useUserBalance();
  const { addTransaction } = useTransactions(projectId);
  const { showSuccess, showError } = useNotifications();
  const isAdmin = user ? isAdminEmail(user.email) : false;
  
  const [inputText, setInputText] = useState('');
  const [parsedEntries, setParsedEntries] = useState<ParsedEntry[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [balanceError, setBalanceError] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingFile, setIsLoadingFile] = useState(false);
  const [editingEntry, setEditingEntry] = useState<{ index: number; entry: ParsedEntry } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Helper function to parse amount patterns
  const parseAmountPattern = (text: string): { first: number; second: number } | null => {
    const cleanText = text.trim();
    
    // Check for parentheses pattern FIRST: 41(10/50), 41(10//50), 41(10by50), 41(10=50), 41(10+50)
    const parenPattern = /^\d*\((\d+(?:\.\d+)?)[\/]{1,2}(\d+(?:\.\d+)?)\)$/;
    const parenByPattern = /^\d*\((\d+(?:\.\d+)?)(?:by|x)(\d+(?:\.\d+)?)\)$/i;
    const parenEqualsPattern = /^\d*\((\d+(?:\.\d+)?)=(\d+(?:\.\d+)?)\)$/;
    const parenPlusPattern = /^\d*\((\d+(?:\.\d+)?)\+(\d+(?:\.\d+)?)\)$/;
    
    if (parenPattern.test(cleanText)) {
      const match = cleanText.match(parenPattern);
      return { first: Number(match![1]), second: Number(match![2]) };
    }
    
    if (parenByPattern.test(cleanText)) {
      const match = cleanText.match(parenByPattern);
      return { first: Number(match![1]), second: Number(match![2]) };
    }
    
    if (parenEqualsPattern.test(cleanText)) {
      const match = cleanText.match(parenEqualsPattern);
      return { first: Number(match![1]), second: Number(match![2]) };
    }
    
    if (parenPlusPattern.test(cleanText)) {
      const match = cleanText.match(parenPlusPattern);
      return { first: Number(match![1]), second: Number(match![2]) };
    }
    
    // Check for nil/n patterns FIRST: N+200, n+200, NIL+200, nil+200, 300+N, 300+nil, 300+ff, 20.nil, 20nil, nil.20, 20xnil, 100bynil, nilx20, nilby100
    const nilPlusNumber = /^(n|nil)\.?\+?(\d+(?:\.\d+)?)$/i;
    const numberPlusNil = /^(\d+(?:\.\d+)?)\.?\+?(n|nil|ff)$/i;
    const numberByNil = /^(\d+(?:\.\d+)?)[\s.]*(by|x)[\s.]*(n|nil)$/i; // 20xnil, 100bynil
    const nilByNumber = /^(n|nil)[\s.]*(by|x)[\s.]*(\d+(?:\.\d+)?)$/i; // nilx20, nilby100
    
    if (nilPlusNumber.test(cleanText)) {
      const match = cleanText.match(nilPlusNumber);
      return { first: 0, second: Number(match![2]) };
    }
    
    if (numberPlusNil.test(cleanText)) {
      const match = cleanText.match(numberPlusNil);
      return { first: Number(match![1]), second: 0 };
    }
    
    if (numberByNil.test(cleanText)) {
      const match = cleanText.match(numberByNil);
      return { first: Number(match![1]), second: 0 };
    }
    
    if (nilByNumber.test(cleanText)) {
      const match = cleanText.match(nilByNumber);
      return { first: 0, second: Number(match![3]) };
    }
    
    // Check for regular number+number pattern: 10+10, 50+100, etc.
    const plusPattern = /^(\d+(?:\.\d+)?)\+(\d+(?:\.\d+)?)$/;
    
    if (plusPattern.test(cleanText)) {
      const match = cleanText.match(plusPattern);
      return { first: Number(match![1]), second: Number(match![2]) };
    }
    
    // Check for ff/ss patterns: ff10, FF10, ff.10, FF.10, 100ff, 100FF, 100-ff, 100-FF (prefix, suffix, and dash)
    const ffPrefixPattern = /^ff\.?(\d+)$/i;
    const fsSuffixPattern = /^(\d+)ff$/i;
    const ffDashPattern = /^(\d+)-ff$/i;
    const ssPrefixPattern = /^ss\.?(\d+)$/i;
    const ssSuffixPattern = /^(\d+)ss$/i;
    const ssDashPattern = /^(\d+)-ss$/i;
    
    if (ffPrefixPattern.test(cleanText)) {
      const match = cleanText.match(ffPrefixPattern);
      return { first: Number(match![1]), second: 0 };
    }
    
    if (fsSuffixPattern.test(cleanText)) {
      const match = cleanText.match(fsSuffixPattern);
      return { first: Number(match![1]), second: 0 };
    }
    
    if (ffDashPattern.test(cleanText)) {
      const match = cleanText.match(ffDashPattern);
      return { first: Number(match![1]), second: 0 };
    }
    
    if (ssPrefixPattern.test(cleanText)) {
      const match = cleanText.match(ssPrefixPattern);
      return { first: 0, second: Number(match![1]) };
    }
    
    if (ssSuffixPattern.test(cleanText)) {
      const match = cleanText.match(ssSuffixPattern);
      return { first: 0, second: Number(match![1]) };
    }
    
    if (ssDashPattern.test(cleanText)) {
      const match = cleanText.match(ssDashPattern);
      return { first: 0, second: Number(match![1]) };
    }
    
    // Check for f/s patterns: ALL VARIATIONS including single f, s, ff, ss, FFF, SSS, etc.
    const fsSingleFirst = /^(\d+)[fF]$/;
    const fsSingleSecond = /^(\d+)[sS]$/;
    const fAlonePattern = /^[\s.]*[fF][\s.]*$/; // f alone, F alone, .f., f. = F 0, S 0
    const sAlonePattern = /^[\s.]*[sS][\s.]*$/; // s alone, S alone, .s., s. = F 0, S 0
    const ffAlonePattern = /^[\s.]*[fF]{2}[\s.]*$/; // ff alone, FF alone = F 0, S 0
    const ssAlonePattern = /^[\s.]*[sS]{2}[\s.]*$/; // ss alone, SS alone = F 0, S 0
    const fffPattern = /^[\s.]*[fF]{3,}[\s.]*$/; // FFF, FFFF = first/nil (F 0, S 0)
    const sssPattern = /^[\s.]*[sS]{3,}[\s.]*$/; // SSS, SSSS = second/nil (F 0, S 0)
    const numberXFFFPattern = /^(\d+(?:\.\d+)?)[\s.]*[xX][\s.]*[fF]+$/; // 10xF, 100xFF, 100xFFF = F 100, S 0
    const numberXSSSPattern = /^(\d+(?:\.\d+)?)[\s.]*[xX][\s.]*[sS]+$/; // 10xS, 100xSS, 100xSSS = F 0, S 100
    const fPrefixPattern = /^[fF][\s.]*(\d+(?:\.\d+)?)$/; // Allow dots/spaces: f20, F 300, F.. 50
    const sPrefixPattern = /^[sS][\s.]*(\d+(?:\.\d+)?)$/; // Allow dots/spaces: s20, S 300, S.. 50
    const fSlashPattern = /^[fF][\s.]*\/[\s.]*(\d+(?:\.\d+)?)$/i; // F/100, f/200
    const sSlashPattern = /^[sS][\s.]*\/[\s.]*(\d+(?:\.\d+)?)$/i; // S/200, s/100
    const fColonPattern = /^[fF][\s.]*:[\s.]*(\d+(?:\.\d+)?)$/i; // F:100, f:200
    const sColonPattern = /^[sS][\s.]*:[\s.]*(\d+(?:\.\d+)?)$/i; // S:200, s:100
    const fPipePattern = /^[fF][\s.]*\|[\s.]*(\d+(?:\.\d+)?)$/i; // F|100, f|200
    const sPipePattern = /^[sS][\s.]*\|[\s.]*(\d+(?:\.\d+)?)$/i; // S|200, s|100
    const fDashPattern = /^[fF][\s.]*-[\s.]*(\d+(?:\.\d+)?)$/i; // F-100, f-200
    const sDashPattern = /^[sS][\s.]*-[\s.]*(\d+(?:\.\d+)?)$/i; // S-200, s-100
    const fsPattern = /^(\d+(?:\.\d+)?)[fF]\s+(\d+(?:\.\d+)?)[sS]$/;
    const fsCompactPattern = /^[fF][\s.]*(\d+(?:\.\d+)?)[sS][\s.]*(\d+(?:\.\d+)?)$/i; // f100s200, F100S200
    const fsEqualsPattern = /^[fF][\s.]*(\d+(?:\.\d+)?)[\s.]*=[\s.]*[sS][\s.]*(\d+(?:\.\d+)?)$/i; // F.100=s.400, f100=s400
    const fsSlashPattern = /^[fF][\s.]*(\d+(?:\.\d+)?)[\s.]*\/[\s.]*[sS][\s.]*(\d+(?:\.\d+)?)$/i; // F.100/S.400, F100/S200
    const fsPlusPattern = /^[fF][\s.]*(\d+(?:\.\d+)?)[\s.]*\+[\s.]*[sS][\s.]*(\d+(?:\.\d+)?)$/i; // F.100+S.400, F100+S200
    const fsColonPattern = /^[fF][\s.]*(\d+(?:\.\d+)?)[\s.]*:[\s.]*[sS][\s.]*(\d+(?:\.\d+)?)$/i; // F.100:S.400, F100:S200
    const fsPipePattern = /^[fF][\s.]*(\d+(?:\.\d+)?)[\s.]*\|[\s.]*[sS][\s.]*(\d+(?:\.\d+)?)$/i; // F.100|S.400, F100|S200
    const fsDashPattern = /^[fF][\s.]*(\d+(?:\.\d+)?)[\s.]*-[\s.]*[sS][\s.]*(\d+(?:\.\d+)?)$/i; // F.100-S.400, F100-S200
    const fsDotSpacePattern = /^[fF][\s.]*([sS])[\s.]*(\d+(?:\.\d+)?)(?:[xX]|by)(\d+(?:\.\d+)?)$/i; // F. S. 25x50
    const fstPattern = /^[\s.]*f(?:a)?st[\s.]*(\d+(?:\.\d+)?)[\s.]*$/i; // fst.50, fast.50, ..fst..50, ..fast..50
    
    // Check ALL f/s/ff/ss/FFF/SSS variations (pattern order matters - check longer patterns first!)
    if (fffPattern.test(cleanText)) {
      return { first: 0, second: 0 }; // FFF = first/nil
    }
    
    if (sssPattern.test(cleanText)) {
      return { first: 0, second: 0 }; // SSS = second/nil
    }
    
    if (ffAlonePattern.test(cleanText)) {
      return { first: 0, second: 0 }; // ff alone = first/nil
    }
    
    if (ssAlonePattern.test(cleanText)) {
      return { first: 0, second: 0 }; // ss alone = second/nil
    }
    
    if (fAlonePattern.test(cleanText)) {
      return { first: 0, second: 0 }; // f alone = first/nil
    }
    
    if (sAlonePattern.test(cleanText)) {
      return { first: 0, second: 0 }; // s alone = second/nil
    }
    
    if (numberXFFFPattern.test(cleanText)) {
      const match = cleanText.match(numberXFFFPattern);
      return { first: Number(match![1]), second: 0 }; // 10xF, 100xFF, 100xFFF = F amount, S 0
    }
    
    if (numberXSSSPattern.test(cleanText)) {
      const match = cleanText.match(numberXSSSPattern);
      return { first: 0, second: Number(match![1]) }; // 10xS, 100xSS, 100xSSS = F 0, S amount
    }
    
    if (fsPattern.test(cleanText)) {
      const match = cleanText.match(fsPattern);
      return { first: Number(match![1]), second: Number(match![2]) };
    }
    
    if (fsCompactPattern.test(cleanText)) {
      const match = cleanText.match(fsCompactPattern);
      return { first: Number(match![1]), second: Number(match![2]) };
    }
    
    if (fsEqualsPattern.test(cleanText)) {
      const match = cleanText.match(fsEqualsPattern);
      return { first: Number(match![1]), second: Number(match![2]) };
    }
    
    if (fsSlashPattern.test(cleanText)) {
      const match = cleanText.match(fsSlashPattern);
      return { first: Number(match![1]), second: Number(match![2]) };
    }
    
    if (fsPlusPattern.test(cleanText)) {
      const match = cleanText.match(fsPlusPattern);
      return { first: Number(match![1]), second: Number(match![2]) };
    }
    
    if (fsColonPattern.test(cleanText)) {
      const match = cleanText.match(fsColonPattern);
      return { first: Number(match![1]), second: Number(match![2]) };
    }
    
    if (fsPipePattern.test(cleanText)) {
      const match = cleanText.match(fsPipePattern);
      return { first: Number(match![1]), second: Number(match![2]) };
    }
    
    if (fsDashPattern.test(cleanText)) {
      const match = cleanText.match(fsDashPattern);
      return { first: Number(match![1]), second: Number(match![2]) };
    }
    
    if (fsDotSpacePattern.test(cleanText)) {
      const match = cleanText.match(fsDotSpacePattern);
      return { first: Number(match![2]), second: Number(match![3]) };
    }
    
    if (fstPattern.test(cleanText)) {
      const match = cleanText.match(fstPattern);
      return { first: Number(match![1]), second: 0 };
    }
    
    if (fSlashPattern.test(cleanText)) {
      const match = cleanText.match(fSlashPattern);
      return { first: Number(match![1]), second: 0 };
    }
    
    if (sSlashPattern.test(cleanText)) {
      const match = cleanText.match(sSlashPattern);
      return { first: 0, second: Number(match![1]) };
    }
    
    if (fColonPattern.test(cleanText)) {
      const match = cleanText.match(fColonPattern);
      return { first: Number(match![1]), second: 0 };
    }
    
    if (sColonPattern.test(cleanText)) {
      const match = cleanText.match(sColonPattern);
      return { first: 0, second: Number(match![1]) };
    }
    
    if (fPipePattern.test(cleanText)) {
      const match = cleanText.match(fPipePattern);
      return { first: Number(match![1]), second: 0 };
    }
    
    if (sPipePattern.test(cleanText)) {
      const match = cleanText.match(sPipePattern);
      return { first: 0, second: Number(match![1]) };
    }
    
    if (fDashPattern.test(cleanText)) {
      const match = cleanText.match(fDashPattern);
      return { first: Number(match![1]), second: 0 };
    }
    
    if (sDashPattern.test(cleanText)) {
      const match = cleanText.match(sDashPattern);
      return { first: 0, second: Number(match![1]) };
    }
    
    if (fsSingleFirst.test(cleanText)) {
      const match = cleanText.match(fsSingleFirst);
      return { first: Number(match![1]), second: 0 };
    }
    
    if (fsSingleSecond.test(cleanText)) {
      const match = cleanText.match(fsSingleSecond);
      return { first: 0, second: Number(match![1]) };
    }
    
    if (fPrefixPattern.test(cleanText)) {
      const match = cleanText.match(fPrefixPattern);
      return { first: Number(match![1]), second: 0 };
    }
    
    if (sPrefixPattern.test(cleanText)) {
      const match = cleanText.match(sPrefixPattern);
      return { first: 0, second: Number(match![1]) };
    }
    
    // Check for /, =, by, x, :, |, - patterns (explicit amount indicators): 50/450, 150/250, 10=10, 10by20, 10x20, 25x50, 50 by 350, 50.by.50, .10..by..50.., 10:20, 10|20, 100-200
    // Note: Asterisk "*" is treated as NUMBER SEPARATOR, not amount pattern
    // Allow dots and/or spaces around patterns
    const slashPattern = /^[\s.]*(\d+(?:\.\d+)?)[\s.]*\/[\s.]*(\d+(?:\.\d+)?)[\s.]*$/; // Dots/spaces optional for 150/250
    const equalsPattern = /^[\s.]*(\d+(?:\.\d+)?)[\s.]*=[\s.]*(\d+(?:\.\d+)?)[\s.]*$/; // Dots/spaces optional for 10=10
    const byPattern = /^[\s.]*(\d+(?:\.\d+)?)[\s.]*(by|x)[\s.]*(\d+(?:\.\d+)?)[\s.]*$/i; // Dots/spaces optional for 50 by 350
    const colonPattern = /^[\s.]*(\d+(?:\.\d+)?)[\s.]*:[\s.]*(\d+(?:\.\d+)?)[\s.]*$/; // 10:20, 100:200
    const pipePattern = /^[\s.]*(\d+(?:\.\d+)?)[\s.]*\|[\s.]*(\d+(?:\.\d+)?)[\s.]*$/; // 10|20, 100|200
    const dashPattern = /^[\s.]*(\d+(?:\.\d+)?)[\s.]*-[\s.]*(\d+(?:\.\d+)?)[\s.]*$/; // 100-200 (standalone only)
    
    if (slashPattern.test(cleanText)) {
      const match = cleanText.match(slashPattern);
      return { first: Number(match![1]), second: Number(match![2]) };
    }
    
    if (equalsPattern.test(cleanText)) {
      const match = cleanText.match(equalsPattern);
      return { first: Number(match![1]), second: Number(match![2]) };
    }
    
    if (byPattern.test(cleanText)) {
      const match = cleanText.match(byPattern);
      return { first: Number(match![1]), second: Number(match![3]) };
    }
    
    if (colonPattern.test(cleanText)) {
      const match = cleanText.match(colonPattern);
      return { first: Number(match![1]), second: Number(match![2]) };
    }
    
    if (pipePattern.test(cleanText)) {
      const match = cleanText.match(pipePattern);
      return { first: Number(match![1]), second: Number(match![2]) };
    }
    
    if (dashPattern.test(cleanText)) {
      const match = cleanText.match(dashPattern);
      return { first: Number(match![1]), second: Number(match![2]) };
    }
    
    // Word-based patterns: first100, second200, 1st100, 2nd200, etc.
    const firstPattern = /^(?:first|1st|f1rst|fir|fst)[\s.]*(\d+(?:\.\d+)?)$/i;
    const secondPattern = /^(?:second|2nd|sec|snd|scnd)[\s.]*(\d+(?:\.\d+)?)$/i;
    const numberFirstPattern = /^(\d+(?:\.\d+)?)[\s.]*(?:first|1st|fir)$/i;
    const numberSecondPattern = /^(\d+(?:\.\d+)?)[\s.]*(?:second|2nd|sec)$/i;
    const amtPattern = /^(?:a|amt|amount)[\s.]*(\d+(?:\.\d+)?)$/i;
    const betPattern = /^(?:b|bet|bett)[\s.]*(\d+(?:\.\d+)?)$/i;
    const winPattern = /^(?:win|w)[\s.]*(\d+(?:\.\d+)?)$/i;
    const losePattern = /^(?:lose|loss|l)[\s.]*(\d+(?:\.\d+)?)$/i;
    
    if (firstPattern.test(cleanText)) {
      const match = cleanText.match(firstPattern);
      return { first: Number(match![1]), second: 0 };
    }
    
    if (secondPattern.test(cleanText)) {
      const match = cleanText.match(secondPattern);
      return { first: 0, second: Number(match![1]) };
    }
    
    if (numberFirstPattern.test(cleanText)) {
      const match = cleanText.match(numberFirstPattern);
      return { first: Number(match![1]), second: 0 };
    }
    
    if (numberSecondPattern.test(cleanText)) {
      const match = cleanText.match(numberSecondPattern);
      return { first: 0, second: Number(match![1]) };
    }
    
    if (amtPattern.test(cleanText)) {
      const match = cleanText.match(amtPattern);
      return { first: Number(match![1]), second: 0 };
    }
    
    if (betPattern.test(cleanText)) {
      const match = cleanText.match(betPattern);
      return { first: 0, second: Number(match![1]) };
    }
    
    if (winPattern.test(cleanText)) {
      const match = cleanText.match(winPattern);
      return { first: Number(match![1]), second: 0 };
    }
    
    if (losePattern.test(cleanText)) {
      const match = cleanText.match(losePattern);
      return { first: 0, second: Number(match![1]) };
    }
    
    // Bracket & Quote patterns: [10/50], {10by50}, <10=50>, '10/50', "10/50", 41[10/50], etc.
    const bracketPattern = /^[\[{<('"]?(\d+(?:\.\d+)?)[\s.]*[\/=+:|by|x][\s.]*(\d+(?:\.\d+)?)[\]}>)'"]+$/i;
    
    if (bracketPattern.test(cleanText)) {
      const match = cleanText.match(/(\d+(?:\.\d+)?)[\s.]*[\/=+:|][\s.]*(\d+(?:\.\d+)?)/);
      if (match) {
        return { first: Number(match[1]), second: Number(match[2]) };
      }
      const byMatch = cleanText.match(/(\d+(?:\.\d+)?)[\s.]*(by|x)[\s.]*(\d+(?:\.\d+)?)/i);
      if (byMatch) {
        return { first: Number(byMatch[1]), second: Number(byMatch[3]) };
      }
    }
    
    // Range/Span patterns: 100~200, 100..200, 100to200, from100to200, etc.
    const rangePattern = /^(?:from)?[\s.]*(\d+(?:\.\d+)?)[\s.]*(?:~|\.{2,3}|to|-to-|→|->)[\s.]*(?:to)?[\s.]*(\d+(?:\.\d+)?)$/i;
    
    if (rangePattern.test(cleanText)) {
      const match = cleanText.match(rangePattern);
      return { first: Number(match![1]), second: Number(match![2]) };
    }
    
    // Multiplication patterns: 10times20, 10mul20, 10xx20, multiply10by20, etc.
    const timesPattern = /^(\d+(?:\.\d+)?)[\s.]*(?:times|xx|mul|multiply)[\s.]*(?:by)?[\s.]*(\d+(?:\.\d+)?)$/i;
    
    if (timesPattern.test(cleanText)) {
      const match = cleanText.match(timesPattern);
      return { first: Number(match![1]), second: Number(match![2]) };
    }
    
    // Conditional/Logic patterns: if100then200, 100or200, 100and200, 100&200
    const conditionalPattern = /^(?:if)?[\s.]*(\d+(?:\.\d+)?)[\s.]*(?:then|or|and|&)[\s.]*(\d+(?:\.\d+)?)$/i;
    
    if (conditionalPattern.test(cleanText)) {
      const match = cleanText.match(conditionalPattern);
      return { first: Number(match![1]), second: Number(match![2]) };
    }
    
    // Sequential patterns: 100next200, 100then200, 100after200
    const sequentialPattern = /^(\d+(?:\.\d+)?)[\s.]*(?:next|then|after)[\s.]*(\d+(?:\.\d+)?)$/i;
    
    if (sequentialPattern.test(cleanText)) {
      const match = cleanText.match(sequentialPattern);
      return { first: Number(match![1]), second: Number(match![2]) };
    }
    
    // Currency symbols: $100, ₹100, €100, £100, ¥100, 100$, 100₹, $100/$200, etc.
    const currencyPrefixPattern = /^[$₹€£¥@#~^%][\s.]*(\d+(?:\.\d+)?)$/;
    const currencySuffixPattern = /^(\d+(?:\.\d+)?)[$₹€£¥]$/;
    const currencyBothPattern = /^[$₹€£¥][\s.]*(\d+(?:\.\d+)?)[\s.]*[\/=+:|][\s.]*[$₹€£¥]?[\s.]*(\d+(?:\.\d+)?)$/;
    
    if (currencyPrefixPattern.test(cleanText)) {
      const match = cleanText.match(/(\d+(?:\.\d+)?)/);
      if (match) return { first: Number(match[1]), second: 0 };
    }
    
    if (currencySuffixPattern.test(cleanText)) {
      const match = cleanText.match(currencySuffixPattern);
      return { first: Number(match![1]), second: 0 };
    }
    
    if (currencyBothPattern.test(cleanText)) {
      const match = cleanText.match(/(\d+(?:\.\d+)?)[\s.]*[\/=+:|][\s.]*(\d+(?:\.\d+)?)/);
      if (match) {
        return { first: Number(match[1]), second: Number(match[2]) };
      }
    }
    
    // Percentage & Ratio: 10%, 10%20, 100÷2, etc.
    const percentagePattern = /^(\d+(?:\.\d+)?)%[\s.]*(\d+(?:\.\d+)?)?$/;
    const dividePattern = /^(\d+(?:\.\d+)?)[\s.]*[÷][\s.]*(\d+(?:\.\d+)?)$/;
    const atPattern = /^(\d+(?:\.\d+)?)[@](\d+(?:\.\d+)?)$/;
    
    if (percentagePattern.test(cleanText)) {
      const match = cleanText.match(percentagePattern);
      const second = match![2] ? Number(match![2]) : 0;
      return { first: Number(match![1]), second: second };
    }
    
    if (dividePattern.test(cleanText)) {
      const match = cleanText.match(dividePattern);
      return { first: Number(match![1]), second: Number(match![2]) };
    }
    
    if (atPattern.test(cleanText)) {
      const match = cleanText.match(atPattern);
      return { first: Number(match![1]), second: Number(match![2]) };
    }
    
    // Abbreviated game types: pk100, rg100, ak100, op100, pkt100
    const pkPattern = /^(?:pk|pkt|packet)[\s.]*(\d+(?:\.\d+)?)$/i;
    const rgPattern = /^(?:rg|ring)[\s.]*(\d+(?:\.\d+)?)$/i;
    const akPattern = /^(?:ak|akra)[\s.]*(\d+(?:\.\d+)?)$/i;
    const opPattern = /^(?:op|open)[\s.]*(\d+(?:\.\d+)?)$/i;
    
    if (pkPattern.test(cleanText)) {
      const match = cleanText.match(pkPattern);
      return { first: Number(match![1]), second: 0 };
    }
    
    if (rgPattern.test(cleanText)) {
      const match = cleanText.match(rgPattern);
      return { first: Number(match![1]), second: 0 };
    }
    
    if (akPattern.test(cleanText)) {
      const match = cleanText.match(akPattern);
      return { first: Number(match![1]), second: 0 };
    }
    
    if (opPattern.test(cleanText)) {
      const match = cleanText.match(opPattern);
      return { first: Number(match![1]), second: 0 };
    }
    
    // Emoji patterns: 💰100, 🎰100, 🎲100
    const emojiPattern = /^[💰🎰🎲][\s.]*(\d+(?:\.\d+)?)$/;
    
    if (emojiPattern.test(cleanText)) {
      const match = cleanText.match(/(\d+(?:\.\d+)?)/);
      if (match) return { first: Number(match[1]), second: 0 };
    }
    
    // Positive/Negative: +100, -100, +100/-200
    const positivePattern = /^\+(\d+(?:\.\d+)?)$/;
    const posNegPattern = /^\+(\d+(?:\.\d+)?)[\s.]*\/[\s.]*-(\d+(?:\.\d+)?)$/;
    
    if (posNegPattern.test(cleanText)) {
      const match = cleanText.match(posNegPattern);
      return { first: Number(match![1]), second: Number(match![2]) };
    }
    
    if (positivePattern.test(cleanText)) {
      const match = cleanText.match(positivePattern);
      return { first: Number(match![1]), second: 0 };
    }
    
    return null;
  };

  const parseIntelligentInput = (text: string): { entries: ParsedEntry[]; errors: string[] } => {
    const entries: ParsedEntry[] = [];
    const parseErrors: string[] = [];
    
    // Clean WhatsApp timestamp lines
    // Format 1: "[28/10/2025 11:16 pm] Username: 89"
    // Format 2: "10/29/25, 7:40 PM - servant Of ALLAH: 3926."
    const whatsappBracketPattern = /^\[.*?\].*?:\s*/;
    const whatsappDashPattern = /^\d{1,2}\/\d{1,2}\/\d{2,4},?\s+\d{1,2}:\d{2}\s+(?:AM|PM|am|pm)?\s*-\s*.*?:\s*/;
    
    const lines = text.split('\n')
      .filter(line => line.trim())
      .map(line => {
        const trimmed = line.trim();
        
        // Remove WhatsApp timestamp (bracketed format)
        if (whatsappBracketPattern.test(trimmed)) {
          return trimmed.replace(whatsappBracketPattern, '');
        }
        
        // Remove WhatsApp timestamp (dash format)
        if (whatsappDashPattern.test(trimmed)) {
          return trimmed.replace(whatsappDashPattern, '');
        }
        
        return trimmed;
      })
      .filter(line => line.length > 0); // Remove empty lines after cleaning

    // Helper function to detect entry type from number length
    const detectEntryType = (num: string): EntryType => {
      const len = num.length;
      if (len === 1) return 'open';
      if (len === 2) return 'akra';
      if (len === 3) return 'ring';
      return 'packet';
    };

    // Helper function to pad numbers to correct length based on entry type
    const padNumber = (num: string, type: EntryType): string => {
      const lengths = { open: 1, akra: 2, ring: 3, packet: 4 };
      return num.padStart(lengths[type], '0');
    };

    // Process lines to support both horizontal and vertical grouping
    let currentNumberGroup: string[] = [];
    let currentNumberLineNums: number[] = [];
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineNum = i + 1;
      const normalized = line.trim().replace(/\s+/g, ' ');
      
      console.log(`\n📝 Processing Line ${lineNum}: "${normalized}"`);
      console.log(`  📊 Current accumulated numbers: [${currentNumberGroup.join(', ')}]`);
      
      // FIRST: Find and extract pattern from the line BEFORE splitting by dots
      let amountPattern: { first: number; second: number } | null = null;
      let isOnlyPattern = false;
      let lineWithoutPattern = normalized;
      
      // Check if the entire line is just a pattern (like "ff.10" alone or ".ff.10")
      // BUT: If it's a parentheses pattern with a number prefix (like "41(10//50)"), it's NOT pattern-only
      const cleanedLine = normalized.replace(/^[.,\s]+/, '').trim(); // Remove leading dots/commas
      const wholeLineParsed = parseAmountPattern(cleanedLine);
      const hasNumberPrefix = /^\d+\([^)]+\)$/.test(cleanedLine); // Check for "41(10//50)" format
      
      if (wholeLineParsed && !hasNumberPrefix) {
        // Pure pattern without number prefix
        amountPattern = wholeLineParsed;
        isOnlyPattern = true;
      } else {
        // Check if line has multiple slashes (chain of numbers like 180/185/367/368)
        // If so, treat / as a NUMBER SEPARATOR, not an amount pattern
        const slashCount = (normalized.match(/\//g) || []).length;
        const equalsCount = (normalized.match(/=/g) || []).length;
        const hasSlashChain = slashCount >= 2; // 2+ slashes means it's a number chain
        const hasEqualsChain = equalsCount >= 2; // 2+ equals means it's a number chain
        
        // Try to find patterns embedded in the line using comprehensive regex
        // Matches: ALL SEPARATORS + F/S patterns + ff/ss + nil + parentheses + WORD-BASED + BRACKETS + CURRENCY + EMOJIS + etc.
        // NOTE: Dash "-" and asterisk "*" in numbers like "905-906" or "3657*365" are separators (UNLESS standalone like "100-200")
        // NOTE: When multiple "/" or "=" appear in a line, they're treated as number separators, not patterns
        // Pattern must have keywords (by, x, ff, ss, nil, f, s, fst, fast, first, second, to, times, or, and, etc.) OR special chars
        // Allow dots and/or spaces around patterns
        const patternRegex = /(?:\d+\([^)]+\)|[\[{<('"]?\d+[\s.]*[\/=+:|by|x][\s.]*\d+[\]}>)'"]+|[\s.]*[fF]{3,}[\s.]*|[\s.]*[sS]{3,}[\s.]*|[\s.]*[fF]{2}[\s.]*|[\s.]*[sS]{2}[\s.]*|[\s.]*[fF][\s.]*|[\s.]*[sS][\s.]*|\d+[\s.]*[xX][\s.]*[fF]+|\d+[\s.]*[xX][\s.]*[sS]+|ff\.+\d+\.+|\d+\.+ff\.+|\d+-ff\.+|ss\.+\d+\.+|\d+\.+ss\.+|\d+-ss\.+|(?:n|nil)\.+\+?\d+\.+|\d+[\s.]*(by|x)[\s.]*(n|nil)|(n|nil)[\s.]*(by|x)[\s.]*\d+|[-=]*\d+\.+\+\d+\.+|\d+[\s.]*[\/=+:|\-~][\s.]*\d+|[fF][\s.]*\d+[sS][\s.]*\d+|[fF][\s.]*\d+[\s.]*[=\/+:|\\-][\s.]*[sS][\s.]*\d+|[fF][\s.]*[\/=+:|\\-][\s.]*\d+|[sS][\s.]*[\/=+:|\\-][\s.]*\d+|\d+[\s.]*(by|x)[\s.]*\d+|[fF][\s.]*[sS][\s.]*\d+(?:by|x)\d+|[\s.]*f(?:a)?st[\s.]*\d+[\s.]*|(?:first|1st|f1rst|fir)[\s.]*\d+|(?:second|2nd|sec|snd)[\s.]*\d+|\d+[\s.]*(?:first|second|1st|2nd)|(?:from)?[\s.]*\d+[\s.]*(?:~|\.{2,3}|to|-to-|→|->)[\s.]*(?:to)?[\s.]*\d+|\d+[\s.]*(?:times|xx|mul|multiply)[\s.]*(?:by)?[\s.]*\d+|(?:if)?[\s.]*\d+[\s.]*(?:then|or|and|&)[\s.]*\d+|\d+[\s.]*(?:next|then|after)[\s.]*\d+|[$₹€£¥@#~^%💰🎰🎲][\s.]*\d+|\d+[$₹€£¥]|\d+%[\s.]*\d*|\d+[÷@]\d+|(?:pk|pkt|rg|ring|ak|akra|op|open|amt|a|bet|b|win|w|lose|loss|l)[\s.]*\d+|\+\d+|\+\d+\/\-\d+|\d+f(?:\s+\d+s)?|\d+s|[fF]\s+\d+|[sS]\s+\d+|[fF][\s.]+\d+|[sS][\s.]+\d+)/gi;
        let patternMatches: RegExpMatchArray | null = normalized.match(patternRegex);
        
        // Filter out slash and equals patterns if they're part of chains
        if (patternMatches && (hasSlashChain || hasEqualsChain)) {
          const filteredMatches = patternMatches.filter(match => {
            // Keep F/S patterns even in chains: F.100/S.400, F/100, S/200, F.100=S.400, F.100+S.400
            const isFSPattern = /^[fF][\s.]*(\d+[\s.]*)?[\/=+][\s.]*([sS][\s.]*)?\d+$/i.test(match) || /^[sS][\s.]*\/[\s.]*\d+$/i.test(match);
            
            if (isFSPattern) {
              return true; // Always keep F/S patterns
            }
            
            const isSlashPattern = /^\d+[\s.]*\/[\s.]*\d+$/.test(match);
            const isEqualsPattern = /^\d+[\s.]*=[\s.]*\d+$/.test(match);
            
            if (hasSlashChain && isSlashPattern) {
              console.log(`  ⚠️  Ignoring slash pattern "${match}" because line has ${slashCount} slashes (number chain)`);
              return false;
            }
            if (hasEqualsChain && isEqualsPattern) {
              console.log(`  ⚠️  Ignoring equals pattern "${match}" because line has ${equalsCount} equals (number chain)`);
              return false;
            }
            return true;
          });
          patternMatches = filteredMatches.length > 0 ? filteredMatches as RegExpMatchArray : null;
        }
        
        if (patternMatches && patternMatches.length > 0) {
          console.log(`  🔍 Found ${patternMatches.length} potential pattern(s): [${patternMatches.join(', ')}]`);
          
          // Try each match to see if it's a valid pattern
          // Process from RIGHT to LEFT (last match first) to prioritize the rightmost pattern
          for (let j = patternMatches.length - 1; j >= 0; j--) {
            const match = patternMatches[j];
            
            // Clean leading/trailing dots and numbers from the match to extract pure pattern
            // e.g., "485.50by50" → "50by50", ".50by100.." → "50by100"
            // For parentheses pattern "41(10//50)", extract number separately
            let extractedNumber: string | null = null;
            let cleanMatch = match;
            
            // Check if pattern has parentheses (like "41(10//50)")
            if (/^\d+\([^)]+\)$/.test(match)) {
              const parenMatch = match.match(/^(\d+)(\([^)]+\))$/);
              if (parenMatch) {
                extractedNumber = parenMatch[1]; // Extract "41"
                cleanMatch = parenMatch[2];       // Keep "(10//50)" as pattern
                console.log(`  🔢 Extracted number from parentheses pattern: "${extractedNumber}" + "${cleanMatch}"`);
              }
            } else {
              // For non-parentheses patterns, clean as before
              cleanMatch = match
                .replace(/^\d+\./, '')  // Remove leading numbers and dot (485.)
                .replace(/^[-=]+/, '')  // Remove leading dashes and equals (handle -200+300, ===200+800)
                .replace(/^[.,;:]+/, '')  // Remove leading punctuation
                .replace(/[.,;:]+$/, ''); // Remove trailing punctuation
            }
            
            console.log(`  🧪 Testing match "${match}" → cleaned: "${cleanMatch}"`);
            const parsed = parseAmountPattern(cleanMatch);
            if (parsed) {
              amountPattern = parsed;
              console.log(`  ✅ Using pattern "${cleanMatch}" → F ${parsed.first}, S ${parsed.second}`);
              
              // If we extracted a number from the pattern, add it back to the line
              if (extractedNumber) {
                lineWithoutPattern = normalized.replace(match, extractedNumber).replace(/[.,;:?]+/g, '.').trim();
              } else {
                lineWithoutPattern = normalized.replace(match, '').replace(/[.,;:?]+/g, '.').trim();
              }
              console.log(`  📄 Line after pattern removal: "${lineWithoutPattern}"`);
              break;
            }
          }
        }
        
        // If still no pattern found, try space-separated tokens
        if (!amountPattern) {
          const tokens = normalized.split(/\s+/);
          for (const token of tokens) {
            // Remove leading/trailing dots, commas, and other punctuation
            const cleanToken = token.replace(/^[.,;:?]+/, '').replace(/[.,;:?]+$/, '');
            
            // Skip if it's a pure number (could be a game number)
            if (/^\d+$/.test(cleanToken) && cleanToken.length <= 4) {
              continue;
            }
            
            const parsed = parseAmountPattern(cleanToken);
            if (parsed) {
              amountPattern = parsed;
              console.log(`  ✅ Found pattern (token) "${cleanToken}" → F ${parsed.first}, S ${parsed.second}`);
              // Remove this token from the line (and clean punctuation)
              lineWithoutPattern = normalized.replace(token, '').replace(/[.,;:?]+/g, '.').trim();
              console.log(`  📄 Line after pattern removal: "${lineWithoutPattern}"`);
              break;
            }
          }
        }
      }
      
      // SECOND: Extract numbers (only if line is not purely a pattern)
      // Split by common separators: spaces, dots, commas, equals, plus, dash, asterisk, slash, etc.
      const numberMatches = lineWithoutPattern.split(/[\s.,+=\-*\/|;:]+/);
      const validNumbers: string[] = [];
      
      // Only extract numbers if this line is not purely an amount pattern
      if (!isOnlyPattern) {
        // Filter to only valid game numbers (1-4 digits, pure numbers only)
        for (const num of numberMatches) {
          const trimmed = num.trim();
          if (/^\d+$/.test(trimmed) && trimmed.length >= 1 && trimmed.length <= 4) {
            validNumbers.push(trimmed);
          }
        }
      }
      
      console.log(`  🔢 Valid numbers extracted: [${validNumbers.join(', ')}]`);
      console.log(`  💰 Pattern detected: ${amountPattern ? `F ${amountPattern.first}, S ${amountPattern.second}` : 'None'}`);
      
      // CASE 1: Line has both numbers AND amount pattern (on the SAME line)
      if (validNumbers.length > 0 && amountPattern) {
        console.log(`  ➡️  CASE 1: Same-line numbers + pattern - Apply to accumulated + current line`);
        
        // Combine accumulated numbers from previous lines with current line's numbers
        const allNumbers = [...currentNumberGroup, ...validNumbers];
        console.log(`  🔗 Combining: accumulated [${currentNumberGroup.join(', ')}] + current [${validNumbers.join(', ')}]`);
        
        // Apply pattern to ALL numbers (accumulated + current)
        for (const num of allNumbers) {
          const detectedType = detectEntryType(num);
          const paddedNumber = padNumber(num, detectedType);
          
          if (!isValidNumber(paddedNumber, detectedType)) {
            parseErrors.push(`Line ${lineNum}: Invalid number "${num}" for ${detectedType} type`);
            continue;
          }
          
          entries.push({
            number: paddedNumber,
            first: amountPattern.first,
            second: amountPattern.second,
            entryType: detectedType,
          });
        }
        
        // Reset accumulator after applying pattern
        currentNumberGroup = [];
        currentNumberLineNums = [];
      }
      // CASE 2: Line has ONLY numbers (vertical format - accumulate)
      else if (validNumbers.length > 0 && !amountPattern) {
        console.log(`  ➡️  CASE 2: Numbers only - Accumulate for next pattern`);
        currentNumberGroup.push(...validNumbers);
        currentNumberLineNums.push(lineNum);
        console.log(`  📦 Accumulated so far: [${currentNumberGroup.join(', ')}]`);
      }
      // CASE 3: Line has ONLY amount pattern (applies to accumulated numbers)
      else if (validNumbers.length === 0 && amountPattern) {
        console.log(`  ➡️  CASE 3: Pattern only - Apply to accumulated numbers from lines ${currentNumberLineNums.join(',')}`);
        if (currentNumberGroup.length === 0) {
          parseErrors.push(`Line ${lineNum}: Amount pattern without numbers`);
          continue;
        }
        
        // Apply pattern to all accumulated numbers
        for (const num of currentNumberGroup) {
          const detectedType = detectEntryType(num);
          const paddedNumber = padNumber(num, detectedType);
          
          if (!isValidNumber(paddedNumber, detectedType)) {
            parseErrors.push(`Lines ${currentNumberLineNums.join(',')}: Invalid number "${num}" for ${detectedType} type`);
            continue;
          }
          
          entries.push({
            number: paddedNumber,
            first: amountPattern.first,
            second: amountPattern.second,
            entryType: detectedType,
          });
        }
        
        // Reset the group
        currentNumberGroup = [];
        currentNumberLineNums = [];
      }
      // CASE 4: Line has neither (error)
      else {
        parseErrors.push(`Line ${lineNum}: Could not parse "${line}"`);
      }
    }
    
    // Check for any remaining numbers without pattern
    if (currentNumberGroup.length > 0) {
      parseErrors.push(`Lines ${currentNumberLineNums.join(',')}: Numbers without amount pattern: ${currentNumberGroup.join(', ')}`);
    }

    return { entries, errors: parseErrors };
  };

  const handleProcess = () => {
    if (!inputText.trim()) {
      setErrors(['Please enter some text to process']);
      return;
    }

    setErrors([]);
    setParsedEntries([]);

    // Parse immediately without delay for instant feedback
      const result = parseIntelligentInput(inputText);
      setParsedEntries(result.entries);
      setErrors(result.errors);
      setShowPreview(true);
  };

  const handleSubmit = async () => {
    if (parsedEntries.length === 0 || isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    setBalanceError(null);

    // Calculate total cost (betting amounts only)
    const totalCost = parsedEntries.reduce(
      (sum, entry) => sum + entry.first + entry.second,
      0
    );

    // Check balance for non-admin users
    if (!isAdmin && !hasSufficientBalance(totalCost)) {
      setBalanceError(
        `Insufficient balance. You need ${formatCurrency(totalCost)} but only have ${formatCurrency(balance)}.`
      );
      return;
    }

    try {
      // Add all transactions with incrementing timestamps to preserve exact entry order
      const baseTime = new Date();
      const transactionsToAdd = parsedEntries.map((entry, index) => ({
        projectId,
        number: entry.number,
        entryType: entry.entryType, // Use auto-detected type
        first: entry.first,
        second: entry.second,
        // Add milliseconds to preserve order (each entry gets +1ms)
        createdAt: new Date(baseTime.getTime() + index).toISOString(),
        updatedAt: new Date(baseTime.getTime() + index).toISOString(),
      }));

      const addPromises = transactionsToAdd.map(transaction => addTransaction(transaction));
      const results = await Promise.all(addPromises);
      const successCount = results.filter(Boolean).length;

      if (successCount === 0) {
        setBalanceError('Failed to add transactions. Please try again.');
        return;
      }

      // Reset form
      setInputText('');
      setParsedEntries([]);
      setErrors([]);
      setShowPreview(false);
      setBalanceError(null);

      // Success notification
      await showSuccess(
        'Entries Added Successfully',
        `Added ${successCount} ${successCount === 1 ? 'entry' : 'entries'} for ${formatCurrency(totalCost)}`,
        { duration: 2000 }
      );

      // Focus back to input for next entry (don't close panel)
      setTimeout(() => {
        const textarea = document.querySelector('textarea');
        if (textarea) textarea.focus();
      }, 50); // Reduced for instant feel

      onSuccess();
    } catch (error) {
      console.error('Error adding transactions:', error);
      await showError(
        'Error Adding Entries',
        'An error occurred while adding transactions. Please try again.',
        { duration: 5000 }
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleWhatsAppUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsLoadingFile(true);
    
    try {
      let text = '';
      
      // Handle .zip files (WhatsApp exports as .zip)
      if (file.name.endsWith('.zip') || file.type === 'application/zip' || file.type === 'application/x-zip-compressed') {
        const arrayBuffer = await file.arrayBuffer();
        const zip = await JSZip.loadAsync(arrayBuffer);
        
        // Find the .txt file inside the zip
        const txtFile = Object.keys(zip.files).find(filename => filename.endsWith('.txt'));
        
        if (!txtFile) {
          await showError(
            'No Text File Found',
            'Could not find a .txt file inside the zip. Please ensure you exported "Without Media".',
            { duration: 5000 }
          );
          return;
        }
        
        // Extract and read the .txt file
        text = await zip.files[txtFile].async('text');
      }
      // Handle direct .txt files
      else if (file.name.endsWith('.txt') || file.type === 'text/plain') {
        text = await file.text();
      }
      // Invalid file type
      else {
        await showError(
          'Invalid File', 
          'Please upload a WhatsApp chat export (.txt or .zip file). Go to WhatsApp → Chat → ⋮ → Export Chat → Without Media',
          { duration: 5000 }
        );
        return;
      }
      
      if (text.trim()) {
        // Set the text to input (WhatsApp timestamps will be auto-removed by parser)
        setInputText(text);
        
        const lineCount = text.split('\n').filter(l => l.trim()).length;
        
        await showSuccess(
          'WhatsApp Chat Loaded',
          `Loaded ${lineCount} lines! Timestamps will be auto-removed. Click "Process Data".`,
          { duration: 3000 }
        );
        
        // Focus textarea
        setTimeout(() => {
          const textarea = document.querySelector('textarea');
          if (textarea) textarea.focus();
        }, 100);
      } else {
        await showError(
          'Empty File',
          'The file appears to be empty. Please export a valid WhatsApp chat.',
          { duration: 5000 }
        );
      }
      
    } catch (error) {
      console.error('File Read Error:', error);
      await showError(
        'Loading Failed',
        'Could not read the file. Make sure it\'s a valid WhatsApp export (.txt or .zip).',
        { duration: 5000 }
      );
    } finally {
      setIsLoadingFile(false);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  return (
    <div className="space-y-4">
      {/* Input Area with Image Upload */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Paste your data here
          </label>
          {/* WhatsApp Chat Upload Icon */}
          <div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".txt,.zip,text/plain,application/zip,application/x-zip-compressed"
              onChange={handleWhatsAppUpload}
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isLoadingFile}
              className="p-2 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white rounded-lg font-semibold transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-md hover:shadow-lg"
              title="Upload WhatsApp chat export (.txt or .zip)"
            >
              {isLoadingFile ? (
                <svg className="w-5 h-5 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                </svg>
              )}
            </button>
          </div>
        </div>
        <textarea
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder={`Paste data here or upload WhatsApp chat export...`}
          className="w-full px-6 py-5 text-xl border-2 border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono resize-none transition-all duration-200"
          rows={15}
          disabled={isLoadingFile}
        />
        <div className="flex items-center justify-between mt-3">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {inputText.split('\n').filter(l => l.trim()).length} lines
          </p>
          <button
            type="button"
            onClick={handleProcess}
            disabled={!inputText.trim()}
            className="px-6 py-3 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white text-sm font-semibold rounded-xl shadow-lg hover:shadow-xl transform hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
          >
            Process Data
          </button>
        </div>
      </div>

      {/* Errors */}
      {errors.length > 0 && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-xl p-3">
          <h4 className="text-sm font-semibold text-red-900 dark:text-red-300 mb-2">
            Errors ({errors.length})
          </h4>
          <div className="text-sm text-red-800 dark:text-red-400 max-h-24 overflow-y-auto space-y-1">
            {errors.slice(0, 3).map((error, idx) => (
              <div key={idx} className="flex items-start">
                <span className="text-red-500 mr-2">•</span>
                <span>{error}</span>
              </div>
            ))}
            {errors.length > 3 && <div className="text-red-600 font-medium">... and {errors.length - 3} more errors</div>}
          </div>
        </div>
      )}

      {/* Balance Error */}
      {balanceError && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-3">
          <div className="flex items-start space-x-3">
            <svg className="w-5 h-5 text-red-600 dark:text-red-400 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div className="flex-1">
              <h4 className="text-sm font-semibold text-red-800 dark:text-red-200 mb-1">Insufficient Balance</h4>
              <p className="text-sm text-red-600 dark:text-red-400">{balanceError}</p>
            </div>
          </div>
        </div>
      )}

      {/* Preview - Shows ALL entries with scrolling and edit ability */}
      {showPreview && parsedEntries.length > 0 && (
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-semibold text-green-900 dark:text-green-300">
              {parsedEntries.length} entries ready to add
            </h4>
            <div className="flex space-x-2">
              <button
                type="button"
                onClick={() => {
                  setParsedEntries([]);
                  setShowPreview(false);
                }}
                className="px-4 py-2 text-sm bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-500 transition-colors min-h-[40px]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="px-6 py-2 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white text-sm font-semibold rounded-lg shadow-lg hover:shadow-xl transform hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 min-h-[40px] disabled:opacity-60 disabled:cursor-not-allowed disabled:transform-none"
              >
                Add {parsedEntries.length}
              </button>
            </div>
          </div>
          {/* Scrollable list showing ALL entries */}
          <div className="max-h-96 overflow-y-auto space-y-2 pr-2">
            {parsedEntries.map((entry, idx) => (
              <div
                key={idx}
                className="bg-white dark:bg-gray-800 rounded-lg p-3 flex justify-between items-center border border-gray-200 dark:border-gray-600 hover:border-blue-400 dark:hover:border-blue-500 transition-colors group"
              >
                <div className="flex items-center gap-3 flex-1">
                  <span className="font-mono font-bold text-gray-900 dark:text-gray-100 text-base">
                  {entry.number}
                </span>
                  <span className="text-xs px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded uppercase font-semibold">
                    {entry.entryType}
                  </span>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-gray-600 dark:text-gray-400 text-sm font-medium">
                  F:{entry.first} S:{entry.second}
                </span>
                  {/* Edit button */}
                  <button
                    type="button"
                    onClick={() => setEditingEntry({ index: idx, entry })}
                    className="opacity-0 group-hover:opacity-100 p-1.5 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/30 rounded-lg transition-all"
                    title="Edit amounts"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Edit Entry Modal */}
      {editingEntry && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-md w-full p-6 border-2 border-gray-200 dark:border-gray-600">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100">
                Edit Entry: {editingEntry.entry.number}
              </h3>
              <button
                onClick={() => setEditingEntry(null)}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="space-y-4">
              {/* Entry Type Badge */}
              <div className="flex items-center gap-2 pb-4 border-b border-gray-200 dark:border-gray-600">
                <span className="text-sm text-gray-600 dark:text-gray-400">Type:</span>
                <span className="px-3 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded-lg uppercase font-semibold text-sm">
                  {editingEntry.entry.entryType}
                </span>
              </div>

              {/* First Amount */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  First Amount
                </label>
                <input
                  type="number"
                  defaultValue={editingEntry.entry.first}
                  id="edit-first"
                  className="w-full px-4 py-3 border-2 border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-lg font-mono"
                  min="0"
                />
              </div>

              {/* Second Amount */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Second Amount
                </label>
                <input
                  type="number"
                  defaultValue={editingEntry.entry.second}
                  id="edit-second"
                  className="w-full px-4 py-3 border-2 border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-lg font-mono"
                  min="0"
                />
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3 mt-6 pt-6 border-t border-gray-200 dark:border-gray-600">
              <button
                onClick={() => setEditingEntry(null)}
                className="flex-1 px-4 py-3 bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-500 font-semibold transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  const firstInput = document.getElementById('edit-first') as HTMLInputElement;
                  const secondInput = document.getElementById('edit-second') as HTMLInputElement;
                  
                  const newFirst = Number(firstInput.value) || 0;
                  const newSecond = Number(secondInput.value) || 0;
                  
                  const updated = [...parsedEntries];
                  updated[editingEntry.index] = {
                    ...editingEntry.entry,
                    first: newFirst,
                    second: newSecond
                  };
                  setParsedEntries(updated);
                  setEditingEntry(null);
                }}
                className="flex-1 px-4 py-3 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white rounded-lg font-semibold shadow-lg hover:shadow-xl transform hover:scale-[1.02] active:scale-[0.98] transition-all"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default IntelligentEntry;

