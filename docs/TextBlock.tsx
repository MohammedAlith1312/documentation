"use client";

import { useState, useEffect, useRef } from 'react';

interface TextIssue {
    id: string;
    text: string;
    issueUrl: string;
    issueNumber: number;
    title: string;
    description: string;
}

interface TextBlockProps {
    initialIssues?: TextIssue[];
}

export default function TextBlock({ initialIssues = [] }: TextBlockProps) {
    const [showInput, setShowInput] = useState(false);
    const [inputPosition, setInputPosition] = useState({ top: 0, left: 0 });
    const [selectedText, setSelectedText] = useState('');
    const [selectionType, setSelectionType] = useState<'text' | 'image'>('text');
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [toast, setToast] = useState<{ show: boolean; message: string }>({ show: false, message: '' });

    // Restore missing state variables
    const [status, setStatus] = useState<'idle' | 'submitting'>('idle');
    const [issues, setIssues] = useState<TextIssue[]>(initialIssues);
    const [hoveredIssue, sethoveredIssue] = useState<TextIssue | null>(null);
    const [showIssueCard, setShowIssueCard] = useState(false);
    const [issueCardPosition, setIssueCardPosition] = useState({ top: 0, left: 0 });

    // New state variables for editing and commenting
    const [isEditing, setIsEditing] = useState(false);
    const [editTitle, setEditTitle] = useState('');
    const [editBody, setEditBody] = useState('');
    const [commentText, setCommentText] = useState('');
    const [showCommentInput, setShowCommentInput] = useState(false);

    const showToastMessage = (message: string) => {
        setToast({ show: true, message });
        setTimeout(() => setToast({ show: false, message: '' }), 3000);
    };

    const inputRef = useRef<HTMLDivElement>(null);
    const issueCardRef = useRef<HTMLDivElement>(null);
    const selectionRangeRef = useRef<Range | null>(null);
    const lastClickedImageRef = useRef<HTMLImageElement | null>(null);

    useEffect(() => {
        // Immediate highlight from server props
        if (initialIssues.length > 0) {
            reapplyHighlights(initialIssues);
        }

        // Fetch existing issues on mount (revalidation)
        const fetchIssues = async () => {
            try {
                const res = await fetch('/api/issues/list');
                const data = await res.json();
                if (data.issues) {
                    const fetchedIssues = data.issues.map((i: any) => ({
                        id: i.id,
                        text: i.selectedText,
                        issueUrl: i.url,
                        issueNumber: i.issueNumber,
                        title: i.title,
                        description: i.body
                    }));
                    setIssues(fetchedIssues);

                    // Delay slightly to ensure DOM is ready? 
                    // Usually mount is fine, but next.js might hydrate.
                    setTimeout(() => {
                        reapplyHighlights(fetchedIssues);
                    }, 500);
                }
            } catch (error) {
                console.error("Failed to fetch issues:", error);
            }
        };

        fetchIssues();
    }, []);

    const reapplyHighlights = (issuesToHighlight: TextIssue[]) => {
        issuesToHighlight.forEach(issue => {
            if (!issue.text) return;

            // Handle Text or Image
            if (!issue.text.startsWith('![')) {
                const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
                const nodesToHighlight: { node: Node, index: number }[] = [];

                let node;
                while (node = walker.nextNode()) {
                    const val = node.nodeValue;
                    if (val && val.includes(issue.text)) {
                        // Check if already highlighted to avoid double-wrapping
                        const parent = node.parentElement;
                        if (parent && parent.classList.contains('issue-highlight')) continue;

                        nodesToHighlight.push({ node, index: val.indexOf(issue.text) });
                    }
                }

                nodesToHighlight.forEach(({ node, index }) => {
                    try {
                        const range = document.createRange();
                        range.setStart(node, index);
                        range.setEnd(node, index + issue.text.length);

                        const span = document.createElement('span');
                        span.className = 'issue-highlight';
                        span.setAttribute('data-issue-id', issue.id);

                        Object.assign(span.style, {
                            backgroundColor: '#a3a7b0ff',
                            color: 'black',
                            cursor: 'pointer',
                            borderRadius: '5px',
                            padding: '2px 0',
                            boxDecorationBreak: 'clone',
                            WebkitBoxDecorationBreak: 'clone'
                        });

                        range.surroundContents(span);
                    } catch (e) {
                        console.error("Re-highlight error:", e);
                    }
                });
            } else {
                // Handle Image highlight Re-application
                const match = issue.text.match(/!\[.*\]\((.*)\)/);
                if (match) {
                    const reportedSrc = match[1];
                    const allImgs = document.querySelectorAll('img');

                    allImgs.forEach(img => {
                        const image = img as HTMLImageElement;
                        // Avoid double-highlighting
                        if (image.classList.contains('issue-highlight-image')) return;

                        // Flexible matching: Absolute, Relative, or Next.js optimized URL
                        const currentSrc = image.src;
                        const attrSrc = image.getAttribute('src');

                        const isMatch = (currentSrc === reportedSrc) ||
                            (attrSrc === reportedSrc) ||
                            (reportedSrc.includes(attrSrc || '___never___')) ||
                            (attrSrc?.includes(reportedSrc) || false);

                        if (isMatch) {
                            image.classList.add('issue-highlight-image');
                            image.setAttribute('data-issue-id', issue.id);
                            Object.assign(image.style, {
                                outline: '4px solid #3b82f6',
                                outlineOffset: '2px',
                                cursor: 'pointer',
                                filter: 'brightness(0.9)',
                                transition: 'all 0.2s ease'
                            });
                        }
                    });
                }
            }
        });
    };

    useEffect(() => {
        const handleTextSelection = () => {
            if (showInput || showIssueCard) return;

            const selection = window.getSelection();

            // Text collision detection: Check if selection is inside an existing issue
            if (selection && selection.rangeCount > 0) {
                const range = selection.getRangeAt(0);
                let node: Node | null = range.commonAncestorContainer;

                // Traverse up to find if we are inside a highlight
                while (node && node !== document.body) {
                    if (node.nodeType === 1 && (node as HTMLElement).classList.contains('issue-highlight')) {
                        const issueId = (node as HTMLElement).getAttribute('data-issue-id');
                        const issue = issues.find(i => i.id === issueId);

                        if (issue) {
                            // Found existing issue! Open it instead of creating new one
                            const rect = (node as HTMLElement).getBoundingClientRect();
                            let left = rect.left + (rect.width / 2) - 160;
                            let top = rect.top - 140;
                            if (top < 10) top = rect.bottom + 10;
                            left = Math.max(10, Math.min(left, window.innerWidth - 330));
                            top = Math.max(10, Math.min(top, window.innerHeight - 200));

                            setIssueCardPosition({ top, left });
                            sethoveredIssue(issue);
                            // Initialize edit state
                            setEditTitle(issue.title);
                            setEditBody(issue.description);
                            setIsEditing(false);
                            setShowCommentInput(false);
                            setShowIssueCard(true);
                            selection.removeAllRanges();
                            return; // STOP! Do not show creation input
                        }
                    }
                    node = node.parentNode;
                }
            }

            const text = selection?.toString().trim();

            if (text && text.length > 0) {
                const range = selection?.getRangeAt(0);

                // Store the range immediately so we don't lose it during async operations
                if (range) {
                    selectionRangeRef.current = range.cloneRange();
                    const rect = range.getBoundingClientRect();

                    if (rect) {
                        // Use fixed positioning relative to viewport
                        let left = rect.left + (rect.width / 2) - 160; // Center horizontally
                        let top = rect.top - 180; // Approx height of input popup

                        // If no room above, show below
                        if (top < 10) {
                            top = rect.bottom + 10;
                        }

                        // Boundary checks
                        left = Math.max(10, Math.min(left, window.innerWidth - 330));
                        top = Math.max(10, Math.min(top, window.innerHeight - 200));

                        setInputPosition({ top, left });
                        setSelectedText(text);
                        setSelectionType('text');
                        setTitle('');
                        setDescription('');
                        setShowInput(true);
                    }
                }
            }
        };

        const handleClickOnHighlight = (e: MouseEvent) => {
            const target = e.target as HTMLElement;
            if (target.classList.contains('issue-highlight') || target.classList.contains('issue-highlight-image')) {
                const issueId = target.getAttribute('data-issue-id');
                const issue = issues.find(i => i.id === issueId);

                if (issue) {
                    const rect = target.getBoundingClientRect();
                    let left = rect.left + (rect.width / 2) - 160;
                    let top = rect.top - 140;
                    if (top < 10) top = rect.bottom + 10;
                    left = Math.max(10, Math.min(left, window.innerWidth - 330));
                    top = Math.max(10, Math.min(top, window.innerHeight - 200));

                    setIssueCardPosition({ top, left });
                    sethoveredIssue(issue);

                    // Initialize edit state
                    setEditTitle(issue.title);
                    setEditBody(issue.description);
                    setIsEditing(false);
                    setShowCommentInput(false);

                    setShowIssueCard(true);
                }
                e.stopPropagation();
            }
        };

        const handleImageClick = (e: MouseEvent) => {
            if (showInput || showIssueCard) return;

            const target = e.target as HTMLElement;
            // Check if clicked element is an image AND not already highlighted
            if (target.tagName === 'IMG' && !target.classList.contains('issue-highlight-image')) {
                e.preventDefault();
                e.stopPropagation();

                const img = target as HTMLImageElement;
                const rect = img.getBoundingClientRect();

                // Center input form over the image
                let left = rect.left + (rect.width / 2) - 160;
                let top = rect.top + (rect.height / 2) - 100;

                // Boundary checks
                left = Math.max(10, Math.min(left, window.innerWidth - 330));
                top = Math.max(10, Math.min(top, window.innerHeight - 200));

                setInputPosition({ top, left });
                setSelectedText(`![${img.alt || 'image'}](${img.src})`);
                setSelectionType('image');
                setTitle('');
                setDescription('');
                setShowInput(true);

                // Store image ref for highlighting later
                lastClickedImageRef.current = img;
                // Clear text selection ref since this is an image
                selectionRangeRef.current = null;
            }
        };

        const handleClickOutside = (e: MouseEvent) => {
            if (inputRef.current && !inputRef.current.contains(e.target as Node)) {
                setShowInput(false);
            }
            if (issueCardRef.current && !issueCardRef.current.contains(e.target as Node)) {
                setShowIssueCard(false);
                setIsEditing(false); // Reset editing state when clicking outside
                setShowCommentInput(false); // Reset comment input state
            }
        };

        document.addEventListener('mouseup', handleTextSelection);
        document.addEventListener('click', handleClickOnHighlight);
        document.addEventListener('click', handleImageClick);
        document.addEventListener('mousedown', handleClickOutside);

        return () => {
            document.removeEventListener('mouseup', handleTextSelection);
            document.removeEventListener('click', handleClickOnHighlight);
            document.removeEventListener('click', handleImageClick);
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [showInput, showIssueCard, issues]);

    // Handle CMD+Enter
    const handleKeyDown = (e: React.KeyboardEvent) => {
        if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
            handleSubmit(e);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        if (e) e.preventDefault();
        if (!description.trim()) return;

        setStatus('submitting');

        // Parse Description for Title (First line is Title, rest is Body)
        const lines = description.trim().split('\n');
        let finalTitle = "";
        let finalBody = "";

        if (lines.length > 0) {
            finalTitle = lines[0].substring(0, 100).trim(); // First line as title
            if (lines.length > 1) {
                finalBody = lines.slice(1).join('\n').trim(); // Rest as body
            } else {
                finalBody = lines[0]; // If only one line, use it for both for context
            }
        } else {
            finalTitle = "New Issue";
        }

        const shortTitle = finalTitle.length > 10 ? finalTitle.substring(0, 10) + '...' : finalTitle;

        try {
            const res = await fetch('/api/issues/create', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    title: shortTitle || "New Issue from Selection",
                    body: `**Description:**\n${finalBody || description}\n\n**Selected ${selectionType === 'image' ? 'Image' : 'Text'}:**\n${selectionType === 'image' ? '' : '> '}${selectedText}\n\n${selectionType === 'image' ? `**Image Link:** ${selectedText.match(/\((.*)\)/)?.[1] || ''}\n\n` : ''}**Page URL:**\n${window.location.href}`,
                }),
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.error);

            // Success!
            showToastMessage("Issue Created Successfully");

            const newIssue: TextIssue = {
                id: `issue-${Date.now()}`,
                text: selectedText,
                issueUrl: data.url,
                issueNumber: data.number,
                title: shortTitle,
                description
            };

            setIssues(prev => [...prev, newIssue]);
            applyHighlight(newIssue);

            // Transition immediately to the "Linked Issue" card
            let targetRect = null;
            if (selectionType === 'image' && lastClickedImageRef.current) {
                targetRect = lastClickedImageRef.current.getBoundingClientRect();
            } else if (selectionRangeRef.current) {
                targetRect = selectionRangeRef.current.getBoundingClientRect();
            }

            if (targetRect) {
                let left = targetRect.left + (targetRect.width / 2) - 160;
                let top = targetRect.top - 140;
                if (top < 10) top = targetRect.bottom + 10;
                left = Math.max(10, Math.min(left, window.innerWidth - 330));

                setIssueCardPosition({ top, left });
                sethoveredIssue(newIssue);
                // Initialize edit state for the new issue
                setEditTitle(newIssue.title);
                setEditBody(newIssue.description);
                setIsEditing(false);
                setShowCommentInput(false);
                setShowIssueCard(true);
            }

            setShowInput(false);
            setTitle('');
            setDescription('');
            // Don't remove ranges here, as we might have just highlighted
            window.getSelection()?.removeAllRanges();
            selectionRangeRef.current = null; // Reset
        } catch (error) {
            console.error('Error:', error);
        } finally {
            setStatus('idle');
        }
    };

    const handleUpdateIssue = async () => {
        if (!hoveredIssue || !editTitle.trim() || !editBody.trim()) return;

        try {
            const res = await fetch('/api/issues/update', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    number: hoveredIssue.issueNumber,
                    title: editTitle,
                    body: editBody
                }),
            });

            if (!res.ok) throw new Error('Failed to update');

            setIssues(prev => prev.map(i =>
                i.id === hoveredIssue.id
                    ? { ...i, title: editTitle, description: editBody }
                    : i
            ));

            // Update hovered issue ref as well
            sethoveredIssue(prev => prev ? ({ ...prev, title: editTitle, description: editBody }) : null);

            setIsEditing(false);
            showToastMessage("Issue Updated Successfully");
        } catch (error) {
            console.error('Update Error:', error);
        }
    };

    const handleCommentOnIssue = async () => {
        if (!hoveredIssue || !commentText.trim()) return;

        try {
            const res = await fetch('/api/issues/comment', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    number: hoveredIssue.issueNumber,
                    comment: commentText
                }),
            });

            if (!res.ok) throw new Error('Failed to comment');

            setCommentText('');
            setShowCommentInput(false);
            showToastMessage("Comment Added Successfully");
        } catch (error) {
            console.error('Comment Error:', error);
        }
    };

    const applyHighlight = (issue: TextIssue) => {
        // Handle Image highlighting
        if (selectionType === 'image' && lastClickedImageRef.current) {
            const img = lastClickedImageRef.current;
            // Ensure we don't apply multiple highlights to same element
            if (img.classList.contains('issue-highlight-image')) return;

            img.classList.add('issue-highlight-image');
            img.setAttribute('data-issue-id', issue.id);
            Object.assign(img.style, {
                outline: '4px solid #3b82f6',
                outlineOffset: '2px',
                cursor: 'pointer',
                filter: 'brightness(0.9)',
                transition: 'all 0.2s ease'
            });
            return;
        }

        // Handle Text highlighting
        const range = selectionRangeRef.current;

        if (!range) {
            if (selectionType === 'text') {
                console.error("No selection range found to highlight");
            }
            return;
        }

        const span = document.createElement('span');
        span.className = 'issue-highlight';
        span.setAttribute('data-issue-id', issue.id);

        Object.assign(span.style, {
            backgroundColor: '#a3a7b0ff', // blue-600
            color: 'black',
            cursor: 'pointer',
            borderRadius: '5px',
            padding: '2px 0',
            boxDecorationBreak: 'clone', // Ensures multi-line highlights look good
            WebkitBoxDecorationBreak: 'clone'
        });

        try {
            // extractContents is safer for selections crossing element boundaries
            const contents = range.extractContents();
            span.appendChild(contents);
            range.insertNode(span);
        } catch (e) {
            console.error('Failed to highlight text:', e);
            // Fallback: just wrap the text content if complex DOM manipulation fails
            try {
                range.surroundContents(span);
            } catch (e2) {
                console.error('Fallback highlight failed:', e2);
            }
        }
    };

    const handleCloseIssue = async () => {
        if (!hoveredIssue) return;

        try {
            const res = await fetch('/api/issues/close', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ number: hoveredIssue.issueNumber }),
            });

            if (!res.ok) throw new Error('Failed to close');

            // Success!
            showToastMessage("Issue Closed Successfully");

            // Remove highlights (Text or Image)
            const highlights = document.querySelectorAll(`[data-issue-id="${hoveredIssue.id}"]`);
            highlights.forEach(el => {
                if (el.classList.contains('issue-highlight')) {
                    // Text highlight removal
                    const parent = el.parentNode;
                    while (el.firstChild) parent?.insertBefore(el.firstChild, el);
                    parent?.removeChild(el);
                } else if (el.classList.contains('issue-highlight-image')) {
                    // Image highlight removal
                    const img = el as HTMLImageElement;
                    img.classList.remove('issue-highlight-image');
                    img.removeAttribute('data-issue-id');
                    img.style.outline = 'none';
                    img.style.outlineOffset = '0';
                    img.style.cursor = 'default';
                }
            });

            setIssues(prev => prev.filter(i => i.id !== hoveredIssue.id));
            setShowIssueCard(false);
            sethoveredIssue(null);
        } catch (error) {
            console.error('Error:', error);
        }
    };

    return (
        <>
            {/* Toast Notification */}
            {toast.show && (
                <div className="fixed bottom-10 left-1/2 transform -translate-x-1/2 z-[10000] bg-gray-900 text-white px-6 py-3 rounded-full shadow-lg text-sm font-medium animate-in fade-in slide-in-from-bottom-5 duration-300 flex items-center gap-2">
                    <span className="text-green-400">✓</span>
                    {toast.message}
                </div>
            )}

            {showInput && (
                <div
                    ref={inputRef}
                    className="fixed z-[9999] bg-white rounded-[20px] shadow-[0_8px_30px_rgb(0,0,0,0.12)] border border-gray-100 p-1 w-[320px] animate-in fade-in zoom-in-95 duration-200"
                    style={{ top: `${inputPosition.top}px`, left: `${inputPosition.left}px`, bottom: 'auto' }}
                >
                    <div className="px-4 pt-3">
                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                            NEW {selectionType === 'image' ? 'IMAGE' : 'TEXT'} ISSUE
                        </span>
                    </div>
                    <div className="p-3">
                        <textarea
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            onKeyDown={handleKeyDown}
                            rows={4}
                            className="w-full p-2 text-[15px] text-gray-800 placeholder-gray-400 focus:outline-none resize-none border border-gray-100 rounded-xl"
                            placeholder="Description"
                            required
                            disabled={status === 'submitting'}
                            autoFocus
                        />
                    </div>

                    <div className="px-4 pb-3 flex items-center justify-between">
                        <span className="text-[13px] text-gray-300 font-medium">
                            ⌘ + Enter to create
                        </span>
                        <button
                            onClick={handleSubmit}
                            disabled={status === 'submitting' || !description.trim()}
                            className="px-5 py-2.5 bg-[#111] text-white text-[14px] font-semibold rounded-[14px] hover:bg-black transition-all active:scale-95 disabled:opacity-30 disabled:pointer-events-none shadow-sm"
                        >
                            {status === 'submitting' ? 'Creating...' : 'Create Issue'}
                        </button>
                    </div>
                </div>
            )}

            {showIssueCard && hoveredIssue && (
                <div
                    ref={issueCardRef}
                    className="fixed z-[9999] bg-white rounded-[24px] shadow-[0_10px_40px_rgba(0,0,0,0.12)] border border-gray-200 p-5 w-[380px] animate-in fade-in zoom-in-95 duration-200"
                    style={{ top: `${issueCardPosition.top}px`, left: `${issueCardPosition.left}px`, bottom: 'auto' }}
                >
                    {isEditing ? (
                        <div className="flex flex-col gap-3">
                            <input
                                value={editTitle}
                                onChange={e => setEditTitle(e.target.value)}
                                className="text-[14px] font-semibold text-gray-900 border border-gray-200 rounded px-2 py-1 w-full"
                                placeholder="Issue Title"
                            />
                            <textarea
                                value={editBody}
                                onChange={e => setEditBody(e.target.value)}
                                className="text-[13px] text-gray-600 border border-gray-200 rounded px-2 py-1 w-full resize-none focus:outline-none"
                                rows={3}
                                placeholder="Description..."
                            />
                            <div className="flex justify-end gap-2">
                                <button onClick={() => setIsEditing(false)} className="text-gray-500 text-xs hover:text-gray-700">Cancel</button>
                                <button onClick={handleUpdateIssue} className="bg-blue-600 text-white text-xs px-3 py-1 rounded-full hover:bg-blue-700">Save</button>
                            </div>
                        </div>
                    ) : (
                        <>
                            <div className="flex items-start justify-between gap-4 mb-3">
                                <div className="flex-1 min-w-0">
                                    <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-0.5">LINKED ISSUE</div>
                                    <div className="text-[14px] font-semibold text-gray-900 truncate">
                                        #{hoveredIssue.issueNumber} {hoveredIssue.title}
                                    </div>
                                </div>
                                <div className="flex items-center gap-1 shrink-0">
                                    <button onClick={() => setIsEditing(true)} className="p-1.5 text-gray-400 hover:text-blue-600 rounded-full hover:bg-blue-50 transition-colors" title="Edit Issue">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path></svg>
                                    </button>
                                    <button onClick={() => setShowCommentInput(!showCommentInput)} className={`p-1.5 ${showCommentInput ? 'text-blue-600 bg-blue-50' : 'text-gray-400 hover:text-blue-600'} rounded-full hover:bg-blue-50 transition-colors`} title="Add Comment">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path></svg>
                                    </button>
                                </div>
                            </div>

                            <div className="mt-2 p-3 bg-gray-50 rounded-xl border border-gray-100 mb-4">
                                <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">QUICK CONTEXT</div>
                                {hoveredIssue.text.startsWith('![') ? (
                                    <div className="text-[13px] text-gray-600 flex items-center gap-2">
                                        <span className="p-1 bg-white border border-gray-200 rounded">🖼️</span>
                                        <span className="truncate">Image selection</span>
                                    </div>
                                ) : (
                                    <div className="text-[13px] text-gray-600 italic line-clamp-2 leading-relaxed">
                                        "{hoveredIssue.text}"
                                    </div>
                                )}
                            </div>

                            {showCommentInput ? (
                                <div className="mt-2 animate-in fade-in slide-in-from-top-2 duration-200">
                                    <textarea
                                        value={commentText}
                                        onChange={e => setCommentText(e.target.value)}
                                        className="w-full text-[13px] border border-gray-200 rounded p-2 mb-2 focus:outline-none focus:border-blue-400 resize-none"
                                        rows={2}
                                        placeholder="Write a comment..."
                                        autoFocus
                                    />
                                    <div className="flex justify-end gap-2">
                                        <button onClick={() => handleCommentOnIssue()} className="bg-gray-900 text-white text-[11px] px-3 py-1 rounded-full hover:bg-gray-800">Post</button>
                                    </div>
                                </div>
                            ) : (
                                <div className="flex items-center gap-2 mt-2">
                                    <button
                                        onClick={() => window.open(hoveredIssue.issueUrl, '_blank')}
                                        className="flex-1 px-4 py-1.5 border border-gray-200 text-gray-900 text-[13px] font-medium rounded-full hover:bg-gray-50 transition-colors"
                                    >
                                        View
                                    </button>
                                    <button
                                        onClick={handleCloseIssue}
                                        className="flex-1 px-4 py-1.5 bg-[#fff1f2] text-[#ef4444] text-[13px] font-medium rounded-full hover:bg-[#ffe4e6] transition-colors"
                                    >
                                        Close
                                    </button>
                                </div>
                            )}
                        </>
                    )}
                </div>
            )}
        </>
    );
}
