export type IssueType = 'Tiny Click Target' | 'Low Contrast' | 'Missing Alt Text' | 'Heading Hierarchy' | 'Too Many CTAs';

export interface UI_Issue {
  element: Element;
  rect: DOMRect;
  type: IssueType;
  message: string;
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
      if (rect.width < 44 || rect.height < 44) {
        issues.push({
          element: el,
          rect,
          type: 'Tiny Click Target',
          message: "Button is too small to tap easily",
        });
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
          issues.push({
            element: el,
            rect,
            type: 'Low Contrast',
            message: "Text is too hard to read (needs more contrast)",
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
        });
      }
    }

    // --- Rule 4: Heading Hierarchy ---
    const match = el.tagName.match(/^H([1-6])$/);
    if (match) {
      const level = parseInt(match[1]);
      // If we jump from H1 straight to H3, that's bad for screen readers
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

    // --- Rule 5 (Collection): Too Many CTAs ---
    // If it's a button with a distinct solid background color, track it.
    if (isInteractive) {
      const style = window.getComputedStyle(el);
      if (style.backgroundColor !== 'rgba(0, 0, 0, 0)' && style.backgroundColor !== 'transparent') {
        primaryButtons.push({ element: el, rect });
      }
    }
  });

  // --- Rule 5 (Processing): Too Many CTAs clustering ---
  const clusteredButtons = new Set<Element>();
  
  primaryButtons.forEach((btnA) => {
    if (clusteredButtons.has(btnA.element)) return;
    
    // Find all primary buttons within a 200px radius
    const cluster = primaryButtons.filter(btnB => {
      const dx = Math.abs(btnA.rect.left - btnB.rect.left);
      const dy = Math.abs(btnA.rect.top - btnB.rect.top);
      return Math.max(dx, dy) < 200;
    });

    // If there are more than 3 primary buttons clustered closely, it's visual clutter
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
