const { getOctokit } = require('../_lib/octokit');

// GET /api/issues/list — list open GitHub issues
module.exports = async function handler(req, res) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
        const owner = process.env.GITHUB_OWNER;
        const repo = process.env.GITHUB_REPO;

        if (!owner || !repo) {
            return res.status(500).json({ error: 'GitHub owner/repo not configured' });
        }

        const octokit = await getOctokit(owner);

        const { data } = await octokit.rest.issues.listForRepo({
            owner,
            repo,
            state: 'open',
            per_page: 100,
        });

        const issues = data.map(issue => {
            const body = issue.body || '';
            let extractedText = '';

            // Try Text selection format
            if (body.includes('**Selected Text:**\n> ')) {
                extractedText = body.split('**Selected Text:**\n> ')[1]?.split('\n')[0]?.trim() || '';
            }
            // Try Image selection format
            else if (body.includes('**Selected Image:**\n')) {
                extractedText = body.split('**Selected Image:**\n')[1]?.split('\n')[0]?.trim() || '';
            }

            return {
                id: `issue-${issue.id}`,
                issueNumber: issue.number,
                title: issue.title,
                body,
                url: issue.html_url,
                selectedText: extractedText,
            };
        }).filter(i => i.selectedText && i.selectedText.length > 0);

        res.status(200).json({ issues });

    } catch (error) {
        console.error('List Error:', error.message);
        res.status(500).json({ error: 'Failed to fetch issues' });
    }
};
