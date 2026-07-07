const fs = require('fs');
const https = require('https');
const path = require('path');

const username = 'bipladip123';
const token = process.env.GITHUB_TOKEN;

const options = {
    headers: {
        'User-Agent': 'Node.js',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
    }
};

function fetchGraphQL(query) {
    return new Promise((resolve, reject) => {
        if (!token) {
            return resolve({ data: { user: { contributionsCollection: { contributionCalendar: { totalContributions: 0 } } } } });
        }
        const postData = JSON.stringify({ query });
        const req = https.request('https://api.github.com/graphql', {
            method: 'POST',
            headers: {
                ...options.headers,
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(postData)
            }
        }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => resolve(JSON.parse(data)));
        });
        req.on('error', reject);
        req.write(postData);
        req.end();
    });
}

function fetchREST(endpoint) {
    return new Promise((resolve, reject) => {
        https.get(`https://api.github.com${endpoint}`, options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => resolve(JSON.parse(data)));
        }).on('error', reject);
    });
}

async function updateStats() {
    try {
        console.log("Fetching user data...");
        const user = await fetchREST(`/users/${username}`);
        const repos = await fetchREST(`/users/${username}/repos?per_page=100`);
        
        const query = `
            query {
                user(login: "${username}") {
                    contributionsCollection {
                        contributionCalendar {
                            totalContributions
                        }
                    }
                }
            }
        `;
        const gqlData = await fetchGraphQL(query);

        const totalRepos = user.public_repos || 0;
        const totalCommits = gqlData?.data?.user?.contributionsCollection?.contributionCalendar?.totalContributions || 0;
        
        let totalStars = 0;
        let languages = {};
        
        if (Array.isArray(repos)) {
            repos.forEach(repo => {
                totalStars += repo.stargazers_count || 0;
                if (repo.language) {
                    languages[repo.language] = (languages[repo.language] || 0) + 1;
                }
            });
        }

        console.log(`Stats fetched: ${totalRepos} repos, ${totalStars} stars, ${totalCommits} commits.`);

        const filesToUpdate = [
            'assets/github-stats.svg',
            'assets/dark/github-stats.svg',
            'assets/telemetry.svg',
            'assets/dark/telemetry.svg'
        ];

        for (const file of filesToUpdate) {
            const filePath = path.join(__dirname, '..', '..', file);
            if (!fs.existsSync(filePath)) continue;

            let content = fs.readFileSync(filePath, 'utf8');

            if (file.includes('github-stats')) {
                content = content.replace(/(TOTAL STARS<\/text><text[^>]+>)\d+(<\/text>)/, `$1${totalStars}$2`);
                content = content.replace(/(\d{4} COMMITS<\/text><text[^>]+>)\d+(<\/text>)/, `$1${totalCommits}$2`);
            } else if (file.includes('telemetry')) {
                content = content.replace(/(font-size="44">)\d+(<\/text><text[^>]+>REPOSITORIES<\/text>)/, `$1${totalRepos}$2`);
            }

            fs.writeFileSync(filePath, content, 'utf8');
            console.log(`Updated ${file}`);
        }
        
    } catch (err) {
        console.error("Error updating stats:", err);
    }
}

updateStats();
