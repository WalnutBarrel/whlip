import React, { useEffect, useState, useRef } from 'react';
import { scanDOM, UI_Issue } from '../utils/domScanner';
import { isEnabledStorage, activeFiltersStorage } from '../utils/storage';
import { rewriteText } from '../utils/ai';

const DraggableTooltip: React.FC<{ 
  message: string; 
  rect: DOMRect; 
  fixAction?: () => void; 
  fixSnippet?: string;
  isAIRewritable?: boolean;
  element?: Element;
}> = ({ message, rect, fixAction, fixSnippet, isAIRewritable, element }) => {
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isRewriting, setIsRewriting] = useState(false);
  const dragStartPos = useRef({ x: 0, y: 0 });
  const initialOffset = useRef({ x: 0, y: 0 });

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    setIsDragging(true);
    dragStartPos.current = { x: e.clientX, y: e.clientY };
    initialOffset.current = { ...offset };
    e.stopPropagation();
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging) return;
    const dx = e.clientX - dragStartPos.current.x;
    const dy = e.clientY - dragStartPos.current.y;
    setOffset({
      x: initialOffset.current.x + dx,
      y: initialOffset.current.y + dy,
    });
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    e.currentTarget.releasePointerCapture(e.pointerId);
    setIsDragging(false);
  };

  const handleAutoFix = (e: React.PointerEvent) => {
    e.stopPropagation();
    if (fixAction) fixAction();
  };

  const handleCopy = (e: React.PointerEvent) => {
    e.stopPropagation();
    if (fixSnippet) {
      navigator.clipboard.writeText(fixSnippet);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleAIRewrite = async (e: React.PointerEvent) => {
    e.stopPropagation();
    if (element && element.textContent && !isRewriting) {
      setIsRewriting(true);
      try {
        const simplifiedText = await rewriteText(element.textContent);
        element.textContent = simplifiedText;
      } catch (err) {
        console.error(err);
      } finally {
        setIsRewriting(false);
      }
    }
  };

  const targetX = -offset.x + rect.width / 2;
  const targetY = -offset.y + 28;
  const isOffset = offset.x !== 0 || offset.y !== 0;

  return (
    <div
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      className={`absolute -top-7 left-0 rounded bg-red-600 px-2 py-1.5 text-xs font-bold text-white shadow whitespace-nowrap pointer-events-auto ${
        isDragging ? 'cursor-grabbing scale-105 shadow-xl' : 'cursor-grab hover:scale-105'
      } transition-all`}
      style={{
        transform: `translate(${offset.x}px, ${offset.y}px)`,
        userSelect: 'none',
        touchAction: 'none',
        zIndex: isDragging ? 50 : 10,
      }}
    >
      {isOffset && (
        <svg className="absolute top-0 left-0 w-full h-full pointer-events-none overflow-visible z-[-1]">
          <line x1={10} y1={14} x2={targetX} y2={targetY} stroke="#dc2626" strokeWidth="2" strokeDasharray="4 2" />
          <circle cx={targetX} cy={targetY} r="4" fill="#dc2626" />
        </svg>
      )}
      <div className="flex flex-col gap-1.5">
        <span>{message}</span>
        {(fixAction || fixSnippet || isAIRewritable) && (
          <div className="flex gap-1.5 mt-0.5 border-t border-red-400/30 pt-1.5 pointer-events-auto">
            {fixAction && (
              <button 
                onPointerDown={handleAutoFix}
                className="px-2 py-0.5 bg-red-800 hover:bg-red-900 rounded shadow-sm text-[10px] font-bold text-white transition-colors cursor-pointer"
              >
                Auto-Fix
              </button>
            )}
            {fixSnippet && (
              <button 
                onPointerDown={handleCopy}
                className="px-2 py-0.5 bg-red-800 hover:bg-red-900 rounded shadow-sm text-[10px] font-bold text-white transition-colors cursor-pointer flex items-center gap-1"
              >
                {copied ? 'Copied ✓' : 'Copy Fix'}
              </button>
            )}
            {isAIRewritable && (
              <button 
                onPointerDown={handleAIRewrite}
                disabled={isRewriting}
                className={`px-2 py-0.5 ${isRewriting ? 'bg-indigo-600 cursor-wait' : 'bg-indigo-500 hover:bg-indigo-600 cursor-pointer'} rounded shadow-sm text-[10px] font-bold text-white transition-colors flex items-center gap-1`}
              >
                {isRewriting ? 'Generating...' : '✨ AI Rewrite'}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

const OverlayRenderer: React.FC = () => {
  const [issues, setIssues] = useState<UI_Issue[]>([]);
  const [, setTick] = useState(0);
  
  // Settings State
  const [isEnabled, setIsEnabled] = useState(true);
  const [activeFilters, setActiveFilters] = useState<string[]>([]);

  useEffect(() => {
    // Load initial settings
    isEnabledStorage.getValue().then(setIsEnabled);
    activeFiltersStorage.getValue().then(setActiveFilters);

    // Watch for changes from popup
    const unwatchEnabled = isEnabledStorage.watch(setIsEnabled);
    const unwatchFilters = activeFiltersStorage.watch(setActiveFilters);

    return () => {
      unwatchEnabled();
      unwatchFilters();
    };
  }, []);

  useEffect(() => {
    if (!isEnabled) return; // Don't run scanner if disabled

    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    
    const runScan = () => {
      const detectedIssues = scanDOM();
      setIssues(detectedIssues);
    };

    timeoutId = setTimeout(runScan, 1000);

    const observer = new MutationObserver(() => {
      if (timeoutId) clearTimeout(timeoutId);
      timeoutId = setTimeout(runScan, 800);
    });

    observer.observe(document.body, { childList: true, subtree: true });
    const updatePositions = () => setTick(t => t + 1);

    window.addEventListener('scroll', updatePositions, { capture: true, passive: true });
    window.addEventListener('resize', updatePositions, { passive: true });

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
      observer.disconnect();
      window.removeEventListener('scroll', updatePositions, { capture: true });
      window.removeEventListener('resize', updatePositions);
    };
  }, [isEnabled]); // Re-bind observer if isEnabled changes

  // Listen for messages from the popup
  useEffect(() => {
    let unlisten: (() => void) | null = null;
    
    import('wxt/browser').then(({ browser }) => {
      const handleMessage = (message: any) => {
        if (message.type === 'GET_ISSUES') {
          // Return the current issues directly as a Promise for the wxt polyfill
          return Promise.resolve({ 
            issues: issues.map(i => ({ type: i.type, message: i.message })) 
          });
        }
      };
      browser.runtime.onMessage.addListener(handleMessage);
      unlisten = () => browser.runtime.onMessage.removeListener(handleMessage);
    }).catch(() => {});

    return () => {
      if (unlisten) unlisten();
    };
  }, [issues]);

  // Global toggle prevents rendering entirely
  if (!isEnabled) return null;

  return (
    <div className="ghost-ui-overlay-container pointer-events-none fixed inset-0 z-[999999]">
      {issues
        .filter(issue => activeFilters.includes(issue.type)) // Apply filtering
        .map((issue, index) => {
        const rect = issue.element.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) return null;

        return (
          <div
            key={index}
            className="absolute border-2 border-red-500 bg-red-500/20 pointer-events-none"
            style={{
              top: rect.top,
              left: rect.left,
              width: rect.width,
              height: rect.height,
            }}
          >
            <DraggableTooltip 
              message={issue.message} 
              rect={rect} 
              fixAction={issue.fixAction} 
              fixSnippet={issue.fixSnippet} 
              isAIRewritable={issue.isAIRewritable}
              element={issue.element}
            />
          </div>
        );
      })}
    </div>
  );
};

export default OverlayRenderer;
