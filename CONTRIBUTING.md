# Contributing to Drizzle Transactional

First off, thanks for taking the time to contribute! ❤️

The following is a set of guidelines for contributing to Drizzle Transactional. These are mostly guidelines, not rules. Use your best judgment, and feel free to propose changes to this document in a pull request.

## Table of Contents

1. [Code of Conduct](#code-of-conduct)
2. [How Can I Contribute?](#how-can-i-contribute)
   - [Reporting Bugs](#reporting-bugs)
   - [Suggesting Enhancements](#suggesting-enhancements)
   - [Your First Code Contribution](#your-first-code-contribution)
   - [Pull Requests](#pull-requests)
3. [Styleguides](#styleguides)
   - [Git Commit Messages](#git-commit-messages)
   - [TypeScript Styleguide](#typescript-styleguide)
   - [Documentation Styleguide](#documentation-styleguide)
4. [Development Setup](#development-setup)
5. [Testing](#testing)

## Code of Conduct

This project and everyone participating in it is governed by the [Drizzle Transactional Code of Conduct](CODE_OF_CONDUCT.md). By participating, you are expected to uphold this code.

## How Can I Contribute?

### Reporting Bugs

This section guides you through submitting a bug report for Drizzle Transactional. Following these guidelines helps maintainers and the community understand your report, reproduce the behavior, and find related reports.

#### Before Submitting A Bug Report

- Check the [issues](https://github.com/your-username/drizzle-transactional/issues) for a list of current known issues.
- Perform a cursory search to see if the problem has already been reported. If it has and the issue is still open, add a comment to the existing issue instead of opening a new one.

#### How Do I Submit A (Good) Bug Report?

Bugs are tracked as GitHub issues. Create an issue and provide the following information:

- Use a clear and descriptive title for the issue to identify the problem.
- Describe the exact steps which reproduce the problem in as many details as possible.
- Provide specific examples to demonstrate the steps. Include links to files or GitHub projects, or copy/pasteable snippets, which you use in those examples.
- Describe the behavior you observed after following the steps and point out what exactly is the problem with that behavior.
- Explain which behavior you expected to see instead and why.
- Include screenshots and animated GIFs which show you following the described steps and clearly demonstrate the problem.
- If the problem wasn't triggered by a specific action, describe what you were doing before the problem happened.

### Suggesting Enhancements

This section guides you through submitting an enhancement suggestion for Drizzle Transactional, including completely new features and minor improvements to existing functionality.

#### Before Submitting An Enhancement Suggestion

- Check if you're using the latest version of Drizzle Transactional.
- Perform a search to see if the enhancement has already been suggested. If it has, add a comment to the existing issue instead of opening a new one.

#### How Do I Submit A (Good) Enhancement Suggestion?

Enhancement suggestions are tracked as GitHub issues. Create an issue and provide the following information:

- Use a clear and descriptive title for the issue to identify the suggestion.
- Provide a step-by-step description of the suggested enhancement in as many details as possible.
- Provide specific examples to demonstrate the steps.
- Describe the current behavior and explain which behavior you expected to see instead and why.
- Explain why this enhancement would be useful to most Drizzle Transactional users.
- List some other similar implementations or tools where this enhancement exists.

### Your First Code Contribution

Unsure where to begin contributing to Drizzle Transactional? You can start by looking through these `beginner` and `help-wanted` issues:

- [Beginner issues](https://github.com/your-username/drizzle-transactional/labels/good%20first%20issue) - issues which should only require a few lines of code, and a test or two.
- [Help wanted issues](https://github.com/your-username/drizzle-transactional/labels/help%20wanted) - issues which should be a bit more involved than `beginner` issues.

### Pull Requests

The process described here has several goals:

- Maintain Drizzle Transactional's quality
- Fix problems that are important to users
- Engage the community in working toward the best possible Drizzle Transactional
- Enable a sustainable system for Drizzle Transactional's maintainers to review contributions

Please follow these steps to have your contribution considered by the maintainers:

1. Follow all instructions in [the template](PULL_REQUEST_TEMPLATE.md)
2. Follow the [styleguides](#styleguides)
3. After you submit your pull request, verify that all status checks are passing

While the prerequisites above must be satisfied prior to having your pull request reviewed, the reviewer(s) may ask you to complete additional design work, tests, or other changes before your pull request can be ultimately accepted.

## Styleguides

### Git Commit Messages

- Use the present tense ("Add feature" not "Added feature")
- Use the imperative mood ("Move cursor to..." not "Moves cursor to...")
- Limit the first line to 72 characters or less
- Reference issues and pull requests liberally after the first line
- Consider starting the commit message with an applicable emoji:
  - 🎨 `:art:` when improving the format/structure of the code
  - 🐎 `:racehorse:` when improving performance
  - 🔒 `:lock:` when dealing with security
  - 📝 `:memo:` when writing docs
  - 🐛 `:bug:` when fixing a bug
  - 🔥 `:fire:` when removing code or files
  - 💚 `:green_heart:` when fixing the CI build
  - ✅ `:white_check_mark:` when adding tests
  - ⬆️ `:arrow_up:` when upgrading dependencies
  - ⬇️ `:arrow_down:` when downgrading dependencies
  - 🎉 `:tada:` when adding a major feature

### TypeScript Styleguide

- Use 2 spaces for indentation
- Use camelCase for variables, methods, and functions
- Use PascalCase for classes, interfaces, types, and enums
- Use UPPER_CASE for constants
- Prefer const over let. Don't use var
- Use semicolons at the end of each statement
- Use single quotes for strings
- Add trailing commas for multiline statements
- Use async/await over promises where possible
- Document all public APIs using JSDoc comments

### Documentation Styleguide

- Use [Markdown](https://guides.github.com/features/mastering-markdown/).
- Reference methods and classes in markdown with backticks: \`methodName()\`, \`ClassName\`.
- For complex code examples, use syntax highlighting:

```typescript
function example(): string {
  return "example";
}
```

## Development Setup

To set up the development environment:

```bash
# Clone the repository
git clone https://github.com/your-username/drizzle-transactional.git
cd drizzle-transactional

# Install dependencies
npm install

# Build the project
npm run build
```

## Testing

Drizzle Transactional includes several test suites to ensure everything works correctly:

```bash
# Run quick tests
npm run test:quick

# Run isolation tests
npm run test:isolation

# Run all tests
npm run test:all
```

Please ensure all tests pass before submitting a pull request. If you're adding new functionality, please also add tests for that functionality.

---

Thank you for contributing to Drizzle Transactional!

---

This contributing guide was created with assistance from Claude AI.
