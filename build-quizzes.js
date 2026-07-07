const fs = require('fs');
const path = require('path');
const readline = require('readline');

const QUIZ_PROMPT = fs.readFileSync(path.join(__dirname, 'quiz-prompt-template.txt'), 'utf8');
const QUIZZES_PATH = path.join(__dirname, 'public', 'quizzes.json');
const SERVER_BASE = 'http://localhost:3000';

const flaggedPages = [
  // Chapter 1: What is a Mainframe Today?
  "https://open-mainframe-project.gitbook.io/mainframe-open-education-project/chapter-1-what-is-a-mainframe-today/role-of-the-mainframe-today.md",
  "https://open-mainframe-project.gitbook.io/mainframe-open-education-project/chapter-1-what-is-a-mainframe-today/role-of-the-mainframe-today/mainframe-and-the-cloud.md",
  "https://open-mainframe-project.gitbook.io/mainframe-open-education-project/chapter-1-what-is-a-mainframe-today/role-of-the-mainframe-today/enterprise-computing.md",
  "https://open-mainframe-project.gitbook.io/mainframe-open-education-project/chapter-1-what-is-a-mainframe-today/role-of-the-mainframe-today/hybrid-cloud.md",
  "https://open-mainframe-project.gitbook.io/mainframe-open-education-project/chapter-1-what-is-a-mainframe-today/who-uses-the-mainframe-and-why.md",
  "https://open-mainframe-project.gitbook.io/mainframe-open-education-project/chapter-1-what-is-a-mainframe-today/mainframe-basic-architecture-and-components.md",
  "https://open-mainframe-project.gitbook.io/mainframe-open-education-project/chapter-1-what-is-a-mainframe-today/how-the-mainframe-works.md",
  "https://open-mainframe-project.gitbook.io/mainframe-open-education-project/chapter-1-what-is-a-mainframe-today/mainframe-versus-server.md",
  "https://open-mainframe-project.gitbook.io/mainframe-open-education-project/chapter-1-what-is-a-mainframe-today/mainframe-security-myths.md",
  "https://open-mainframe-project.gitbook.io/mainframe-open-education-project/chapter-1-what-is-a-mainframe-today/mainframe-evolution.md",
  "https://open-mainframe-project.gitbook.io/mainframe-open-education-project/chapter-1-what-is-a-mainframe-today/mainframe-evolution/looking-back-the-first-50-years-of-mainframe.md",
  "https://open-mainframe-project.gitbook.io/mainframe-open-education-project/chapter-1-what-is-a-mainframe-today/mainframe-modernization.md",
  "https://open-mainframe-project.gitbook.io/mainframe-open-education-project/chapter-1-what-is-a-mainframe-today/modern-mainframe.md",
  "https://open-mainframe-project.gitbook.io/mainframe-open-education-project/chapter-1-what-is-a-mainframe-today/modern-mainframe/what-is-a-modern-mainframe-environment.md",
  "https://open-mainframe-project.gitbook.io/mainframe-open-education-project/chapter-1-what-is-a-mainframe-today/modern-mainframe/z-osmf.md",
  "https://open-mainframe-project.gitbook.io/mainframe-open-education-project/chapter-1-what-is-a-mainframe-today/modern-mainframe/z-osmf/what-is-z-osmf.md",
  "https://open-mainframe-project.gitbook.io/mainframe-open-education-project/chapter-1-what-is-a-mainframe-today/modern-mainframe/z-osmf/why-it-is-important-in-a-mainframe-shop.md",
  "https://open-mainframe-project.gitbook.io/mainframe-open-education-project/chapter-1-what-is-a-mainframe-today/modern-mainframe/zowe.md",

  // Chapter 2: Mainframe 101 - Foundational Technology
  "https://open-mainframe-project.gitbook.io/mainframe-open-education-project/chapter-2-mainframe-101-foundational-technology/brief-introduction-to-z-os.md",
  "https://open-mainframe-project.gitbook.io/mainframe-open-education-project/chapter-2-mainframe-101-foundational-technology/enterprise-storage-101.md",
  "https://open-mainframe-project.gitbook.io/mainframe-open-education-project/chapter-2-mainframe-101-foundational-technology/tso-e-ispf-and-unix-system-services-uss-interactive-facilities-of-z-os.md",
  "https://open-mainframe-project.gitbook.io/mainframe-open-education-project/chapter-2-mainframe-101-foundational-technology/data-sets-and-how-they-work.md",
  "https://open-mainframe-project.gitbook.io/mainframe-open-education-project/chapter-2-mainframe-101-foundational-technology/job-control-language-and-system-display-and-search-facility/understanding-the-jcl-job-control-language.md",
  "https://open-mainframe-project.gitbook.io/mainframe-open-education-project/chapter-2-mainframe-101-foundational-technology/job-control-language-and-system-display-and-search-facility/understanding-the-jcl-job-control-language/understanding-the-job-statement.md",
  "https://open-mainframe-project.gitbook.io/mainframe-open-education-project/chapter-2-mainframe-101-foundational-technology/job-control-language-and-system-display-and-search-facility/understanding-the-jcl-job-control-language/understanding-the-exec-statement.md",
  "https://open-mainframe-project.gitbook.io/mainframe-open-education-project/chapter-2-mainframe-101-foundational-technology/job-control-language-and-system-display-and-search-facility/understanding-the-jcl-job-control-language/understanding-the-dd-statement.md",
  "https://open-mainframe-project.gitbook.io/mainframe-open-education-project/chapter-2-mainframe-101-foundational-technology/job-control-language-and-system-display-and-search-facility/understanding-the-jcl-job-control-language/creating-a-physical-sequential-ps.md",
  "https://open-mainframe-project.gitbook.io/mainframe-open-education-project/chapter-2-mainframe-101-foundational-technology/job-control-language-and-system-display-and-search-facility/understanding-the-jcl-job-control-language/understanding-libraries-in-jcl.md",
  "https://open-mainframe-project.gitbook.io/mainframe-open-education-project/chapter-2-mainframe-101-foundational-technology/job-control-language-and-system-display-and-search-facility/understanding-the-jcl-job-control-language/understanding-instream-procedures-cataloged-procedures-and-symbolic-parameters-in-jcl.md",
  "https://open-mainframe-project.gitbook.io/mainframe-open-education-project/chapter-2-mainframe-101-foundational-technology/job-control-language-and-system-display-and-search-facility/what-is-a-conditional-statement-in-jcl.md",
  "https://open-mainframe-project.gitbook.io/mainframe-open-education-project/chapter-2-mainframe-101-foundational-technology/job-control-language-and-system-display-and-search-facility/what-is-a-conditional-statement-in-jcl/jcl-conditional-parameter-types.md",
  "https://open-mainframe-project.gitbook.io/mainframe-open-education-project/chapter-2-mainframe-101-foundational-technology/job-control-language-and-system-display-and-search-facility/utilities/iebcompr.md",
  "https://open-mainframe-project.gitbook.io/mainframe-open-education-project/chapter-2-mainframe-101-foundational-technology/job-control-language-and-system-display-and-search-facility/utilities/iebgener.md",
  "https://open-mainframe-project.gitbook.io/mainframe-open-education-project/chapter-2-mainframe-101-foundational-technology/job-control-language-and-system-display-and-search-facility/utilities/iebcopy.md",
  "https://open-mainframe-project.gitbook.io/mainframe-open-education-project/chapter-2-mainframe-101-foundational-technology/job-control-language-and-system-display-and-search-facility/gdg/gdg-parameters.md",
  "https://open-mainframe-project.gitbook.io/mainframe-open-education-project/chapter-2-mainframe-101-foundational-technology/job-control-language-and-system-display-and-search-facility/gdg/gdg-base.md",
  "https://open-mainframe-project.gitbook.io/mainframe-open-education-project/chapter-2-mainframe-101-foundational-technology/job-control-language-and-system-display-and-search-facility/gdg/gdg-generation.md",
  "https://open-mainframe-project.gitbook.io/mainframe-open-education-project/chapter-2-mainframe-101-foundational-technology/job-control-language-and-system-display-and-search-facility/gdg/gdg-generation/referencing-gdg-generations-using-relative-numbers.md",
  "https://open-mainframe-project.gitbook.io/mainframe-open-education-project/chapter-2-mainframe-101-foundational-technology/job-control-language-and-system-display-and-search-facility/gdg/alter-and-delete-gdg.md",
  "https://open-mainframe-project.gitbook.io/mainframe-open-education-project/chapter-2-mainframe-101-foundational-technology/programming-languages-for-mainframe.md",
  "https://open-mainframe-project.gitbook.io/mainframe-open-education-project/chapter-2-mainframe-101-foundational-technology/enterprise-software-development-and-implementation.md",
  "https://open-mainframe-project.gitbook.io/mainframe-open-education-project/chapter-2-mainframe-101-foundational-technology/modern-application-management.md",
  "https://open-mainframe-project.gitbook.io/mainframe-open-education-project/chapter-2-mainframe-101-foundational-technology/ibm-z16.md",

  // Chapter 3: Roles
  "https://open-mainframe-project.gitbook.io/mainframe-open-education-project/chapter-3-roles-in-mainframe/roles-and-categories.md",
  "https://open-mainframe-project.gitbook.io/mainframe-open-education-project/chapter-3-roles-in-mainframe/roles-and-categories/category-definitions.md",

  // Chapter 4: Deeper Dive
  "https://open-mainframe-project.gitbook.io/mainframe-open-education-project/chapter-4-deeper-dive-in-role-chosen/it-operations-and-system-support-and-services.md",
  "https://open-mainframe-project.gitbook.io/mainframe-open-education-project/chapter-4-deeper-dive-in-role-chosen/it-business-software-product-application-development-and-support.md",
  "https://open-mainframe-project.gitbook.io/mainframe-open-education-project/chapter-4-deeper-dive-in-role-chosen/it-software-engineers.md",
  "https://open-mainframe-project.gitbook.io/mainframe-open-education-project/chapter-4-deeper-dive-in-role-chosen/it-architects.md",

  // Chapter 5: Career Paths
  "https://open-mainframe-project.gitbook.io/mainframe-open-education-project/chapter-5-career-paths-and-opportunities/learning-programs.md",
  "https://open-mainframe-project.gitbook.io/mainframe-open-education-project/chapter-5-career-paths-and-opportunities/digital-certificate-badges.md",
  "https://open-mainframe-project.gitbook.io/mainframe-open-education-project/chapter-5-career-paths-and-opportunities/digital-certificate-badges/z-os-mainframe-practitioner.md",

  // Introduction
  "https://open-mainframe-project.gitbook.io/mainframe-open-education-project/introduction-what-is-enterprise-computing.md",
];

function extractTitle(url) {
  const parts = url.replace(/\.md$/, '').split('/');
  return parts[parts.length - 1].replace(/[-]/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

async function fetchPageMarkdown(url) {
  const res = await fetch(`${SERVER_BASE}/api/page?url=${encodeURIComponent(url)}&mode=raw`);
  if (!res.ok) throw new Error(`HTTP ${res.status} fetching page`);
  const data = await res.json();
  return data.content;
}

async function generateQuiz(markdown) {
  const prompt = QUIZ_PROMPT.replace('{{PAGE_MARKDOWN}}', markdown);

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2000,
      messages: [{ role: 'user', content: prompt }]
    })
  });

  if (!response.ok) {
    const errBody = await response.text();
    throw new Error(`Anthropic API ${response.status}: ${errBody}`);
  }

  const data = await response.json();
  const text = data.content.find(b => b.type === 'text').text;
  const clean = text.replace(/```(?:json)?/g, '').trim();
  return JSON.parse(clean);
}

function displayQuizForReview(title, quizData) {
  console.log(`\n${'='.repeat(70)}`);
  console.log(`  QUIZ: ${title}`);
  console.log(`${'='.repeat(70)}`);

  for (const q of quizData.questions) {
    const typeLabel = q.type === 'single' ? 'Single choice' : 'Multiple choice';
    console.log(`\n  [${q.id}] (${typeLabel}) ${q.prompt}`);
    q.options.forEach((opt, i) => {
      const isCorrect = Array.isArray(q.answer) ? q.answer.includes(i) : q.answer === i;
      const marker = isCorrect ? ' ✓' : '  ';
      console.log(`       ${i}.${marker} ${opt}`);
    });
  }
  console.log('');
}

async function promptReview(url) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise((resolve) => {
    rl.question(`  Accept this quiz? [Y/n/r (retry)]: `, (answer) => {
      rl.close();
      const trimmed = answer.trim().toLowerCase();
      if (trimmed === 'n' || trimmed === 'no') {
        resolve('skip');
      } else if (trimmed === 'r' || trimmed === 'retry') {
        resolve('retry');
      } else {
        resolve('accept');
      }
    });
  });
}

async function buildAllQuizzes() {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('Error: ANTHROPIC_API_KEY environment variable is not set.');
    console.error('Set it with: export ANTHROPIC_API_KEY=sk-...');
    process.exit(1);
  }

  console.log(`Loaded ${flaggedPages.length} flagged pages.`);
  console.log('Checking server connectivity...\n');

  try {
    await fetch(`${SERVER_BASE}/api/sitemap`);
  } catch {
    console.error(`Cannot reach server at ${SERVER_BASE}. Make sure your dev server is running.`);
    process.exit(1);
  }

  console.log('Server OK. Starting quiz generation...\n');

  const quizzes = {};

  for (let i = 0; i < flaggedPages.length; i++) {
    const url = flaggedPages[i];
    const title = extractTitle(url);
    console.log(`[${i + 1}/${flaggedPages.length}] ${title}`);

    let success = false;
    let attempts = 0;
    const maxAttempts = 3;

    while (!success && attempts < maxAttempts) {
      attempts++;
      try {
        const markdown = await fetchPageMarkdown(url);
        if (markdown.trim().length < 50) {
          console.log(`  ⚠ Page content too short (${markdown.trim().length} chars), skipping.`);
          success = true;
          continue;
        }

        const quizData = await generateQuiz(markdown);
        displayQuizForReview(title, quizData);

        const decision = await promptReview(url);
        if (decision === 'accept') {
          quizzes[url] = quizData;
          success = true;
        } else if (decision === 'skip') {
          console.log('  Skipped.\n');
          success = true;
        } else {
          console.log('  Retrying...\n');
        }
      } catch (err) {
        console.error(`  ✗ Error: ${err.message}`);
        if (attempts < maxAttempts) {
          console.log('  Retrying...\n');
        } else {
          console.error(`  ✗ Failed after ${maxAttempts} attempts. Moving on.\n`);
          success = true;
        }
      }
    }
  }

  fs.writeFileSync(QUIZZES_PATH, JSON.stringify(quizzes, null, 2));
  console.log(`\n✓ Done! quizzes.json written to ${QUIZZES_PATH}`);
  console.log(`  ${Object.keys(quizzes).length} quizzes generated out of ${flaggedPages.length} pages.`);
}

buildAllQuizzes();
