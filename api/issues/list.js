const { App } = require('octokit');

async function getOctokit(owner) {
    const appId = process.env.GITHUB_APP_ID;
    const privateKey = process.env.GITHUB_APP_PRIVATE_KEY;

    if (!appId || !privateKey) {
        throw new Error('Missing GITHUB_APP_ID or GITHUB_APP_PRIVATE_KEY');
    }

    const normalizedKey = privateKey.replace(/\\n/g, '\n').trim();

    const githubApp = new App({
        appId: parseInt(appId, 10),
        privateKey: normalizedKey,
    });

    const { data: installations } = await githubApp.octokit.rest.apps.listInstallations();

    let targetInstallId;
    if (owner) {
        const match = installations.find(i => i.account?.login === owner);
        if (match) targetInstallId = match.id;
    }
    if (!targetInstallId && installations.length > 0) {
        targetInstallId = installations[0].id;
    }
    if (!targetInstallId) {
        throw new Error('No GitHub App installation found');
    }

    return await githubApp.getInstallationOctokit(targetInstallId);
}

// GET /api/issues/list
module.exports = async function handler(req, res) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }
    try {
        const owner = process.env.GITHUB_OWNER;
        const repo = process.env.GITHUB_REPO;

        if (!owner || !repo) {
            return res.status(500).json({ error: 'GITHUB_OWNER or GITHUB_REPO not set' });
        }

        const octokit = await getOctokit(owner);

        const { data } = await octokit.rest.issues.listForRepo({
            owner, repo,
            state: 'open',
            per_page: 100,
        });

        const issues = data.map(issue => {
            const body = issue.body || '';
            let extractedText = '';
            if (body.includes('**Selected Text:**\n> ')) {
                extractedText = body.split('**Selected Text:**\n> ')[1]?.split('\n')[0]?.trim() || '';
            } else if (body.includes('**Selected Context:**\n> ')) {
                extractedText = body.split('**Selected Context:**\n> ')[1]?.split('\n')[0]?.trim() || '';
            } else if (body.includes('**Selected Image:**\n')) {
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
        res.status(500).json({ error: error.message || 'Failed to list issues' });
    }
};
