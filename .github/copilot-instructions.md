# GitHub Copilot Instructions

## Language Requirements

**IMPORTANT: All code comments, documentation, commit messages, and any text-based content in this repository MUST be written in English only.**

## Code Guidelines

### Comments and Documentation

- Write all code comments in clear, concise English
- Use proper English grammar and spelling in all comments
- Avoid non-English characters, words, or phrases in comments
- Document functions, classes, and complex logic in English
- Use English for JSDoc/TSDoc documentation comments

### Variable and Function Naming

- Use descriptive English names for variables, functions, classes, and methods
- Follow camelCase convention for TypeScript/JavaScript
- Use meaningful English words that clearly describe the purpose
- Avoid abbreviations unless they are widely understood (e.g., `id`, `url`, `api`)

### Code Examples

```typescript
// ✅ CORRECT - English comments
/**
 * Executes a database transaction with the specified isolation level
 * @param callback - The function to execute within the transaction
 * @param options - Transaction configuration options
 * @returns Promise that resolves with the callback result
 */
async function runInTransaction<T>(
  callback: () => Promise<T>,
  options?: TransactionOptions
): Promise<T> {
  // Initialize transaction context
  const context = await createTransactionContext(options);

  try {
    // Execute the callback within the transaction scope
    return await callback();
  } catch (error) {
    // Rollback transaction on error
    await context.rollback();
    throw error;
  }
}

// ❌ INCORRECT - Non-English comments
/**
 * Выполняет транзакцию базы данных
 */
async function runInTransaction() {
  // инициализация контекста
  // ...
}
```

## Documentation Standards

### README and Documentation Files

- Write all documentation in English
- Use proper English grammar and technical terminology
- Include clear examples and explanations
- Follow standard markdown formatting

### Error Messages and Logging

- All error messages must be in English
- Log messages should be in English
- User-facing messages should be in English
- Use descriptive error messages that help with debugging

### Commit Messages

- Write commit messages in English using conventional commit format
- Examples:
  - `feat: add transaction isolation level support`
  - `fix: resolve deadlock issue in nested transactions`
  - `docs: update API reference documentation`
  - `refactor: improve transaction context management`

## Testing and Examples

### Test Descriptions

- Test names and descriptions must be in English
- Use descriptive test names that explain what is being tested
- Comment test scenarios in English

### Example Code

- All example code should have English comments
- Example documentation should be in English
- Variable names in examples should use English words

## File and Directory Naming

### File Names

- Use English words for file and directory names
- Follow kebab-case for file names where appropriate
- Use descriptive names that indicate the file's purpose

### Configuration Files

- Configuration comments should be in English
- Configuration documentation should be in English
- Use English for configuration property descriptions

## Copilot Behavior

When generating code suggestions:

1. **Always use English** for any comments, documentation, or text content
2. **Generate meaningful variable names** using English words
3. **Provide English explanations** for complex code logic
4. **Follow TypeScript/JavaScript best practices** with English naming conventions
5. **Include proper JSDoc comments** in English for functions and classes
6. **Suggest English error messages** and logging statements
7. **Recommend English commit messages** when working with git

## Quality Assurance

### Automated Checks

- The repository includes linting rules to enforce English-only comments
- Spell checking is configured to validate English text
- CI/CD pipeline includes language compliance checks

### Code Review Guidelines

- Reviewers should ensure all new code follows English-only requirements
- Any non-English content should be flagged during code review
- Documentation updates must maintain English consistency

## Resources

### Style Guides

- Follow [Google TypeScript Style Guide](https://google.github.io/styleguide/tsguide.html)
- Use [Conventional Commits](https://www.conventionalcommits.org/) for commit messages
- Reference [JSDoc standards](https://jsdoc.app/) for documentation

### Tools

- Use ESLint with English-only comment rules
- Configure spell checkers for English dictionaries
- Set up IDE language settings to English

---

_These instructions ensure consistency and maintainability of the codebase while making it accessible to the global developer community._
