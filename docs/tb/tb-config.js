export const API_BASE = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://localhost:3000/api/issues'
    : 'https://documentation-34fr.onrender.com/api/issues';

export const state = {
    issues: [],
    status: 'idle',           // 'idle' | 'submitting'
    selectedText: '',
    selectionType: 'text',    // 'text' | 'image'
    showInput: false,
    showToolbar: false,
    activeIssue: null,
    showIssueCard: false,
    isEditing: false,
    showCommentInput: false,
    selectionRange: null,
    lastClickedImage: null
};
