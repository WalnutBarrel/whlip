export type IssueType = 'Tiny Click Target' | 'Low Contrast' | 'Missing Alt Text' | 'Heading Hierarchy' | 'Too Many CTAs' | 'Content Readability' | 'Missing Form Label' | 'Empty Interactive Element' | 'Z-Index Overlap';

export interface UI_Issue {
  element: Element;
  rect: DOMRect;
  type: IssueType;
  message: string;
  fixAction?: () => void;
  fixSnippet?: string;
  isAIRewritable?: boolean;
}

function getLuminance(r: number, g: number, b: number) {
  const a = [r, g, b].map((v) => {
    v /= 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
  return a[0] * 0.2126 + a[1] * 0.7152 + a[2] * 0.0722;
}

function getContrast(rgb1: number[], rgb2: number[]) {
  const l1 = getLuminance(rgb1[0], rgb1[1], rgb1[2]);
  const l2 = getLuminance(rgb2[0], rgb2[1], rgb2[2]);
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}

function parseRGB(color: string): number[] | null {
  const match = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  return match ? [parseInt(match[1]), parseInt(match[2]), parseInt(match[3])] : null;
}

function calculateFleschKincaid(text: string): number {
  const words = text.split(/\s+/).filter(w => w.length > 0).length;
  if (words === 0) return 100;
  
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0).length || 1;
  
  const syllables = text.split(/\s+/).reduce((acc, word) => {
    word = word.toLowerCase().replace(/[^a-z]/g, '');
    if (word.length <= 3) return acc + 1;
    word = word.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, '');
    word = word.replace(/^y/, '');
    const matches = word.match(/[aeiouy]{1,2}/g);
    return acc + (matches ? matches.length : 1);
  }, 0);

  return 206.835 - 1.015 * (words / sentences) - 84.6 * (syllables / words);
}

export function scanDOM(): UI_Issue[] {
  const issues: UI_Issue[] = [];
  const allElements = document.querySelectorAll('*');
  
  let lastHeadingLevel = 0;
  const primaryButtons: { element: Element; rect: DOMRect }[] = [];

  allElements.forEach((el) => {
    const rect = el.getBoundingClientRect();
    
    // Skip invisible elements
    if (rect.width === 0 || rect.height === 0) return;
    
    // --- Rule 1: Tiny Click Targets ---
    const isInteractive = ['A', 'BUTTON', 'INPUT', 'SELECT', 'TEXTAREA'].includes(el.tagName) || el.getAttribute('role') === 'button';
    if (isInteractive) {
      const style = window.getComputedStyle(el);
      const isInline = style.display === 'inline';
      
      const isCheckboxOrRadio = el.tagName === 'INPUT' && ['checkbox', 'radio'].includes((el as HTMLInputElement).type);
      
      const hasIcon = el.querySelector('svg') !== null || el.querySelector('img') !== null || (el.getAttribute('class') || '').toLowerCase().includes('icon');
      const isIconOnly = (['BUTTON', 'A'].includes(el.tagName) || el.getAttribute('role') === 'button') && (!el.textContent || el.textContent.trim() === '') && hasIcon;

      // Skip inline text links (they are constrained by text line height)
      if (!(el.tagName === 'A' && isInline && el.textContent?.trim())) {
        const minSize = (isCheckboxOrRadio || isIconOnly) ? 24 : 44;

        if (rect.width < minSize || rect.height < minSize) {
          issues.push({
            element: el,
            rect,
            type: 'Tiny Click Target',
            message: isIconOnly ? "Icon button is too small to tap easily" : "Button is too small to tap easily",
            fixAction: () => {
              (el as HTMLElement).style.minWidth = `${minSize}px`;
              (el as HTMLElement).style.minHeight = `${minSize}px`;
            },
            fixSnippet: `min-width: ${minSize}px; min-height: ${minSize}px;`,
          });
        }
      }
    }

    // --- Rule 2: Low Contrast Detection ---
    if (el.textContent && el.textContent.trim().length > 0 && el.children.length === 0) {
      const style = window.getComputedStyle(el);
      const color = parseRGB(style.color);
      let parent: Element | null = el;
      let bgColor = null;

      while (parent) {
        const parentStyle = window.getComputedStyle(parent);
        if (parentStyle.backgroundColor !== 'rgba(0, 0, 0, 0)' && parentStyle.backgroundColor !== 'transparent') {
          bgColor = parseRGB(parentStyle.backgroundColor);
          break;
        }
        parent = parent.parentElement;
      }

      if (color && bgColor) {
        const contrast = getContrast(color, bgColor);
        const isLargeText = parseInt(style.fontSize) >= 18 || (parseInt(style.fontSize) >= 14 && (style.fontWeight === 'bold' || parseInt(style.fontWeight) >= 700));
        const requiredContrast = isLargeText ? 3 : 4.5;
        
        if (contrast < requiredContrast) {
          const bgLum = getLuminance(bgColor[0], bgColor[1], bgColor[2]);
          const newColor = bgLum > 0.5 ? '#111111' : '#EEEEEE';
          issues.push({
            element: el,
            rect,
            type: 'Low Contrast',
            message: "Text is too hard to read (needs more contrast)",
            fixAction: () => {
              (el as HTMLElement).style.color = newColor;
            },
            fixSnippet: `color: ${newColor};`,
          });
        }
      }
    }

    // --- Rule 3: Missing Alt Text ---
    if (el.tagName === 'IMG') {
      const alt = el.getAttribute('alt');
      // If alt is completely missing (not even empty string), it's a strict accessibility failure
      if (alt === null) {
        issues.push({
          element: el,
          rect,
          type: 'Missing Alt Text',
          message: "Image is missing description (alt text)",
          fixAction: () => {
            el.setAttribute('alt', 'Descriptive placeholder');
          },
          fixSnippet: `alt="Descriptive placeholder"`,
        });
      }
    }

    // --- Rule 4: Heading Hierarchy ---
    const match = el.tagName.match(/^H([1-6])$/);
    if (match) {
      const level = parseInt(match[1]);
      if (lastHeadingLevel > 0 && level - lastHeadingLevel > 1) {
        issues.push({
          element: el,
          rect,
          type: 'Heading Hierarchy',
          message: `Skipped heading level (H${lastHeadingLevel} down to H${level})`,
        });
      }
      lastHeadingLevel = level;
    }

    // --- Rule 5: Content Readability ---
    if (el.tagName === 'P') {
      const text = el.textContent || '';
      if (text.length > 100) {
        const score = calculateFleschKincaid(text);
        if (score < 50) {
          issues.push({
            element: el,
            rect,
            type: 'Content Readability',
            message: `Text is too complex (Readability Score: ${Math.round(score)})`,
            isAIRewritable: true,
          });
        }
      }
    }

    // --- Rule 7: Missing Form Labels ---
    if (['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName)) {
      const inputEl = el as HTMLInputElement;
      if (inputEl.type !== 'hidden' && inputEl.type !== 'submit' && inputEl.type !== 'button' && inputEl.type !== 'reset') {
        const id = inputEl.id;
        const ariaLabel = inputEl.getAttribute('aria-label');
        const ariaLabelledBy = inputEl.getAttribute('aria-labelledby');
        let hasLabel = !!(ariaLabel || ariaLabelledBy || el.closest('label'));
        
        if (!hasLabel && id) {
          try {
            if (document.querySelector(`label[for="${id}"]`)) hasLabel = true;
          } catch (e) {
            // In case of invalid ID selector
          }
        }
        
        if (!hasLabel) {
          issues.push({
            element: el,
            rect,
            type: 'Missing Form Label',
            message: "Form input is missing a label",
            fixAction: () => el.setAttribute('aria-label', 'Input label'),
            fixSnippet: `aria-label="Input label"`,
          });
        }
      }
    }

    // --- Rule 8: Empty or Vague Interactive Elements ---
    if (['A', 'BUTTON'].includes(el.tagName) || el.getAttribute('role') === 'button') {
      const text = el.textContent?.trim() || '';
      const ariaLabel = el.getAttribute('aria-label')?.trim();
      const hasIcon = el.querySelector('svg') !== null || el.querySelector('img') !== null;
      
      if (!text && !ariaLabel && !hasIcon) {
        issues.push({
          element: el,
          rect,
          type: 'Empty Interactive Element',
          message: "Interactive element has no content or label",
          fixAction: () => el.setAttribute('aria-label', 'Descriptive label'),
          fixSnippet: `aria-label="Descriptive label"`,
        });
      } else if (text && !ariaLabel) {
        const lowerText = text.toLowerCase();
        if (['click here', 'read more', 'more', 'link', 'button', 'submit'].includes(lowerText)) {
          issues.push({
            element: el,
            rect,
            type: 'Empty Interactive Element',
            message: `Vague link/button text: "${text}"`,
            fixAction: () => el.setAttribute('aria-label', 'Descriptive label for screen readers'),
            fixSnippet: `aria-label="Descriptive label for screen readers"`,
          });
        }
      }
    }

    // --- Rule 9: Z-Index / Overlap Detection ---
    if (isInteractive) {
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      
      // Ensure the center point is within the viewport
      if (centerX >= 0 && centerX <= window.innerWidth && centerY >= 0 && centerY <= window.innerHeight) {
        const topEl = document.elementFromPoint(centerX, centerY);
        
        if (topEl) {
          // If the top element is not the button itself, and the button doesn't contain it
          // and it's not the body/html (which happens if element is under z-index -1 layer somehow but still inside viewport, though rare)
          // and it's not our own extension's UI
          if (topEl !== el && 
              !el.contains(topEl) && 
              topEl.tagName !== 'HTML' && 
              topEl.tagName !== 'BODY' &&
              topEl.tagName.toLowerCase() !== 'ghost-ui-overlay' &&
              !topEl.closest('ghost-ui-overlay')) {
            
            issues.push({
              element: el,
              rect,
              type: 'Z-Index Overlap',
              message: "Interactive element is covered by another element",
              fixAction: () => {
                (el as HTMLElement).style.zIndex = '9999';
                (el as HTMLElement).style.position = 'relative';
              },
              fixSnippet: `position: relative; z-index: 9999;`
            });
          }
        }
      }
    }

    // --- Rule 6 (Collection): Too Many CTAs ---
    if (isInteractive) {
      const style = window.getComputedStyle(el);
      if (style.backgroundColor !== 'rgba(0, 0, 0, 0)' && style.backgroundColor !== 'transparent') {
        primaryButtons.push({ element: el, rect });
      }
    }
  });

  // --- Rule 6 (Processing): Too Many CTAs clustering ---
  const clusteredButtons = new Set<Element>();
  
  primaryButtons.forEach((btnA) => {
    if (clusteredButtons.has(btnA.element)) return;
    
    // Find all primary buttons within a 200px radius
    const cluster = primaryButtons.filter(btnB => {
      const dx = Math.abs(btnA.rect.left - btnB.rect.left);
      const dy = Math.abs(btnA.rect.top - btnB.rect.top);
      return Math.max(dx, dy) < 200;
    });

    if (cluster.length > 3) {
      cluster.forEach(c => {
        if (!clusteredButtons.has(c.element)) {
          clusteredButtons.add(c.element);
          issues.push({
            element: c.element,
            rect: c.rect,
            type: 'Too Many CTAs',
            message: "Too many primary buttons close together",
          });
        }
      });
    }
  });

  return issues;
}
