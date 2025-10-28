// ============================================
// CLIPBOARD UTILITIES
// ============================================

/**
 * Copy text to clipboard
 */
export const copyToClipboard = async (text: string): Promise<boolean> => {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      // Modern clipboard API
      await navigator.clipboard.writeText(text);
      return true;
    } else {
      // Fallback for older browsers or non-secure contexts
      const textArea = document.createElement('textarea');
      textArea.value = text;
      textArea.style.position = 'fixed';
      textArea.style.left = '-999999px';
      textArea.style.top = '-999999px';
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();

      const successful = document.execCommand('copy');
      document.body.removeChild(textArea);

      return successful;
    }
  } catch (err) {
    console.error('Failed to copy to clipboard:', err);
    return false;
  }
};

/**
 * Copy array data as tab-separated values (for Excel paste)
 */
export const copyArrayAsTable = async (
  data: Array<Record<string, string | number>>
): Promise<boolean> => {
  if (data.length === 0) return false;

  try {
    // Get headers
    const headers = Object.keys(data[0]);

    // Create tab-separated string
    const headerRow = headers.join('\t');
    const dataRows = data.map((row) => {
      return headers.map((header) => row[header] ?? '').join('\t');
    });

    const tsvContent = [headerRow, ...dataRows].join('\n');

    return await copyToClipboard(tsvContent);
  } catch (err) {
    console.error('Failed to copy table:', err);
    return false;
  }
};

/**
 * Copy numbers as comma-separated values
 */
export const copyNumbersList = async (numbers: string[]): Promise<boolean> => {
  const text = numbers.join(', ');
  return await copyToClipboard(text);
};

/**
 * Copy summary statistics
 */
export const copySummaryStats = async (stats: {
  title: string;
  items: Array<{ label: string; value: string | number }>;
}): Promise<boolean> => {
  const lines = [stats.title, ''];
  stats.items.forEach(({ label, value }) => {
    lines.push(`${label}: ${value}`);
  });
  const text = lines.join('\n');
  return await copyToClipboard(text);
};

/**
 * Read text from clipboard
 */
export const readFromClipboard = async (): Promise<string | null> => {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      return await navigator.clipboard.readText();
    } else {
      // Fallback not available for reading
      console.warn('Clipboard read not available');
      return null;
    }
  } catch (err) {
    console.error('Failed to read from clipboard:', err);
    return null;
  }
};

/**
 * Check if clipboard API is available
 */
export const isClipboardAvailable = (): boolean => {
  return !!(navigator.clipboard && window.isSecureContext);
};

/**
 * Show copy feedback to user
 */
export const showCopyFeedback = (message: string = 'Copied to clipboard!'): void => {
  // Create temporary notification
  const notification = document.createElement('div');
  notification.textContent = message;
  notification.style.cssText = `
    position: fixed;
    bottom: 20px;
    right: 20px;
    background: #10b981;
    color: white;
    padding: 12px 24px;
    border-radius: 8px;
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    z-index: 10000;
    font-size: 14px;
    font-weight: 500;
    animation: slideIn 0.3s ease;
  `;

  // Add animation
  const style = document.createElement('style');
  style.textContent = `
    @keyframes slideIn {
      from {
        transform: translateY(100%);
        opacity: 0;
      }
      to {
        transform: translateY(0);
        opacity: 1;
      }
    }
    @keyframes slideOut {
      from {
        transform: translateY(0);
        opacity: 1;
      }
      to {
        transform: translateY(100%);
        opacity: 0;
      }
    }
  `;
  document.head.appendChild(style);

  document.body.appendChild(notification);

  // Remove after 2 seconds
  setTimeout(() => {
    notification.style.animation = 'slideOut 0.2s ease';
    setTimeout(() => {
      document.body.removeChild(notification);
      document.head.removeChild(style);
    }, 200); // Reduced animation duration
  }, 1500); // Reduced display duration
};

/**
 * Copy with feedback
 */
export const copyWithFeedback = async (
  text: string,
  successMessage?: string
): Promise<boolean> => {
  const success = await copyToClipboard(text);
  if (success) {
    showCopyFeedback(successMessage);
  }
  return success;
};

