const { getOctokit } = require('../_lib/octokit');

module.exports = async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }
    try {
        const { title, body } = req.body;
        if (!title || !body) {
            return res.status(400).json({ error: 'Missing title or body' });
        }
        const owner = process.env.GITHUB_OWNER;
        const repo = process.env.GITHUB_REPO;
        if (!owner || !repo) {
            return res.status(500).json({ error: 'GITHUB_OWNER or GITHUB_REPO not set' });
        }
        const octokit = await getOctokit(owner);
        const response = await octokit.rest.issues.create({ owner, repo, title, body });
        res.status(200).json({
            success: true,
            url: response.data.html_url,
            number: response.data.number,
        });
    } catch (error) {
        console.error('Create Error:', error.message);
        res.status(500).json({ error: error.message || 'Failed to create issue' });
    }
};
