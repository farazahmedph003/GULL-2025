import React, { useEffect, useMemo, useRef, useState } from 'react';

type EntryType = 'open' | 'akra' | 'ring' | 'packet';

export interface Token {
    number: string;
    first: number;
    second: number;
    entryType: EntryType;
    raw: string;
    errors: string[];
}

interface Props {
    entryType: EntryType;
    value?: string;
    onTokensChange: (tokens: Token[], raw: string) => void;
    disabled?: boolean;
    fontSize?: number;
    compact?: boolean;
    colors?: {
        number?: string;
        first?: string;
        second?: string;
        error?: string;
        text?: string;
        bg?: string;
        chipBg?: string;
    };
}

const typeConfig: Record<EntryType, { digits: number; max: number }> = {
	open: { digits: 1, max: 9 },
	akra: { digits: 2, max: 99 },
	ring: { digits: 3, max: 999 },
	packet: { digits: 4, max: 9999 },
};

function tokenize(raw: string): Array<{ raw: string; number: string; first?: number; second?: number }> {
	const text = raw
		.replace(/\u00A0/g, ' ')
		.replace(/[\t]+/g, ' ')
		.replace(/\b([fs]+)\s{1,3}(\d+)/gi, (_, letters, digits) => `${letters}${digits}`)
		.trim();
	const parts = text.split(/\s+|\n|;|,/).filter(Boolean);
	const tokens: Array<{ raw: string; number: string; first?: number; second?: number }> = [];

	for (let i = 0; i < parts.length; i++) {
		const p = parts[i];
		const numMatch = p.match(/^(\d{1,4})$/) || p.match(/^(\d{1,4})(?:f|s).*$/i);
		if (!numMatch) continue;

		let number = numMatch[1];
		let first: number | undefined;
		let second: number | undefined;
		let consumed = 0;

		const lookahead = parts.slice(i, i + 4).join(' ');
		const fs1 = lookahead.match(/(?:^|\s)f+(\d+)(?=\s|$)/i);
		const ss1 = lookahead.match(/(?:^|\s)s+(\d+)(?=\s|$)/i);
		const slash = lookahead.match(/(\d+)\s*\/\s*(\d+)/);
		const soloNum = lookahead.match(/(?:^|\s)(\d{1,5})(?=\s|$)/g);

		if (slash) {
			first = Number(slash[1]);
			second = Number(slash[2]);
			consumed = 3;
		} else {
			if (fs1) first = Number(fs1[1]);
			if (ss1) second = Number(ss1[1]);
			if (!first && !second && soloNum && soloNum.length) {
				first = Number((soloNum[0].match(/\d+/) || ['0'])[0]);
			}
			consumed = 2;
		}

		tokens.push({ raw: lookahead.trim(), number, first, second });
		i += Math.max(0, consumed - 1);
	}

	return tokens;
}

function normalizeAndValidate(toks: ReturnType<typeof tokenize>, entryTypeHint: EntryType): Token[] {
	return toks.map(t => {
		const errors: string[] = [];
		const entryType: EntryType = ((): EntryType => {
			const len = t.number.length;
			if (len === 1) return 'open';
			if (len === 2) return 'akra';
			if (len === 3) return 'ring';
			if (len === 4) return 'packet';
			return entryTypeHint;
		})();

		const cfg = typeConfig[entryType];
		const numeric = Number(t.number);
		if (Number.isNaN(numeric) || numeric < 0 || numeric > cfg.max) {
			errors.push(`Number out of range for ${entryType} (0-${cfg.max})`);
		}

		const number = String(Math.max(0, Math.min(cfg.max, isNaN(numeric) ? 0 : numeric))).padStart(cfg.digits, '0');
		const first = Math.max(0, Number(t.first || 0));
		const second = Math.max(0, Number(t.second || 0));

		return { number, first, second, entryType, raw: t.raw, errors };
	});
}

const FormattedEntryEditor: React.FC<Props> = ({
    entryType,
    value,
    onTokensChange,
    disabled,
    fontSize = 14,
    compact = false,
    colors,
}) => {
    const [raw, setRaw] = useState(value || '');
    const containerRef = useRef<HTMLTextAreaElement>(null);

	const pal = {
		number: colors?.number || '#facc15',
		first: colors?.first || '#22c55e',
		second: colors?.second || '#ec4899',
		error: colors?.error || '#ef4444',
		text: colors?.text || '#0f172a',
		bg: colors?.bg || '#ffffff',
		chipBg: colors?.chipBg || '#0b12291a',
	};

    const tokens = useMemo(() => normalizeAndValidate(tokenize(raw), entryType), [raw, entryType]);

    useEffect(() => {
        onTokensChange(tokens, raw);
    }, [tokens, raw, onTokensChange]);

	const handlePaste: React.ClipboardEventHandler<HTMLTextAreaElement> = (e) => {
		e.preventDefault();
		const pasted = e.clipboardData.getData('text');
		setRaw(prev => (prev ? prev + '\n' + pasted : pasted));
	};

    const handleKeyDown: React.KeyboardEventHandler<HTMLTextAreaElement> = () => {};

	return (
    <div>
            {/* Clean input area only */}

            <textarea
                ref={containerRef as any}
                value={raw}
                onChange={(e) => setRaw(e.target.value)}
                onPaste={handlePaste}
                onKeyDown={handleKeyDown}
                disabled={disabled}
                aria-label="Formatted entry input"
                style={{
                    width: '100%',
                    boxSizing: 'border-box',
                    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
                    fontSize,
                    lineHeight: compact ? 1.2 : 1.5,
                    color: pal.text,
                    background: pal.bg,
                    border: '1px solid rgba(0,0,0,0.12)',
                    borderRadius: 8,
                    padding: compact ? '8px' : '12px',
                    minHeight: 120,
                    outline: 'none',
                    resize: 'vertical',
                }}
                placeholder="Paste or type numbers with F/S amounts (e.g., 12 f100 s200, 07 50/50)"
            />

            {/* Minimal live preview */}
            <div style={{ marginTop: 8 }}>
                {tokens.length === 0 && raw.trim() === '' ? null : (
                    tokens.map((t, idx) => {
                        const hasError = t.errors.length > 0;
                        return (
                            <span
                                key={idx}
                                style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: 8,
                                    padding: '4px 8px',
                                    margin: '4px 6px 0 0',
                                    borderRadius: 6,
                                    background: pal.chipBg,
                                    border: hasError ? `1px solid ${pal.error}` : '1px solid transparent',
                                }}
                            >
                                <span style={{ color: pal.number, fontWeight: 700 }}>{t.number}</span>
                                <span style={{ color: pal.first }}>F {t.first}</span>
                                <span style={{ color: pal.second }}>S {t.second}</span>
                                {hasError && (
                                    <span style={{ color: pal.error, fontWeight: 600 }}>
                                        {t.errors[0]}
                                    </span>
                                )}
                            </span>
                        );
                    })
                )}
            </div>

            {/* Minimal summary */}
            <div style={{ marginTop: 8, fontSize: fontSize - 2, opacity: 0.85 }}>
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                    <span>Entries: {tokens.length}</span>
                </div>
            </div>
		</div>
	);
};

export default FormattedEntryEditor;


