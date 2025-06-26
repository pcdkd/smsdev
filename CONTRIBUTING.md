# Contributing to sms-dev

We're excited that you're interested in contributing to **sms-dev**! This guide will help you get started.

## 🤝 How to Contribute

### Bug Reports

Before creating a bug report, please check if the issue already exists. When you create a bug report, include as many details as possible:

- **Clear description** of the issue
- **Steps to reproduce** the behavior
- **Expected vs actual behavior**
- **Environment details** (OS, Node.js version, npm version)
- **Log output** if available

### Feature Requests

We welcome feature requests! Please:

- Check if the feature already exists or is planned
- Describe the use case clearly
- Explain why this feature would be useful to the community
- Consider implementation complexity

### Pull Requests

1. **Fork the repository** and create your feature branch
2. **Make your changes** following our coding standards
3. **Test your changes** thoroughly
4. **Update documentation** if needed
5. **Submit a pull request** with a clear description

## 🛠️ Development Setup

### Prerequisites

- **Node.js 18+**
- **npm 8+**
- **Git**

### Getting Started

```bash
# Fork and clone the repository
git clone https://github.com/your-username/relay-works.git
cd relay-works

# Install dependencies
npm install

# Build all packages
npm run build

# Start development
cd apps/sms-dev
npm run dev
```

### Project Structure

```
apps/sms-dev/               # Main CLI application
├── src/
│   ├── cli.ts             # CLI entry point
│   ├── commands/          # CLI commands
│   └── utils/             # Utility functions
├── examples/              # Integration examples
└── dist/                  # Built output

packages/
├── sms-dev-api/           # Express API server
├── sms-dev-ui/            # Next.js UI interface
├── sms-dev-types/         # TypeScript definitions
└── typescript-config/     # Shared TypeScript config
```

### Development Workflow

1. **Create a feature branch**
   ```bash
   git checkout -b feature/amazing-feature
   ```

2. **Make your changes**
   - Follow the existing code style
   - Add/update tests as needed
   - Update documentation

3. **Build and test**
   ```bash
   npm run build
   npm test
   ```

4. **Test the CLI locally**
   ```bash
   ./apps/sms-dev/dist/cli.js start
   ```

5. **Commit your changes**
   ```bash
   git commit -m "feat: add amazing feature"
   ```

6. **Push and create PR**
   ```bash
   git push origin feature/amazing-feature
   ```

## 📝 Coding Standards

### TypeScript

- Use **TypeScript** for all new code
- Follow **strict mode** settings
- Add proper type annotations
- Avoid `any` types when possible

### Code Style

- Use **2 spaces** for indentation
- Use **single quotes** for strings
- Add **trailing commas** in objects/arrays
- Follow **existing patterns** in the codebase

### Commit Messages

We follow the [Conventional Commits](https://conventionalcommits.org/) specification:

```
type(scope): description

feat: add webhook retry functionality
fix: resolve port conflict issue
docs: update API documentation
test: add unit tests for CLI commands
```

**Types:**
- `feat`: New features
- `fix`: Bug fixes
- `docs`: Documentation changes
- `test`: Test additions/changes
- `refactor`: Code refactoring
- `chore`: Maintenance tasks

## 🧪 Testing

### Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage
```

### Writing Tests

- Write tests for new features
- Update tests when modifying existing code
- Aim for good test coverage
- Test both happy paths and error cases

### Test Types

1. **Unit Tests** - Test individual functions/modules
2. **Integration Tests** - Test component interactions
3. **End-to-End Tests** - Test complete workflows

## 📚 Documentation

### Code Documentation

- Add **JSDoc comments** for public APIs
- Include **usage examples** in complex functions
- Document **TypeScript interfaces** and types

### README Updates

When adding new features:
- Update the main README.md
- Add usage examples
- Update CLI command documentation

### API Documentation

If you modify API endpoints:
- Update API documentation
- Include request/response examples
- Document error responses

## 🚀 Release Process

### Version Bumping

We use semantic versioning (semver):
- **Major** (x.0.0): Breaking changes
- **Minor** (0.x.0): New features (backward compatible)
- **Patch** (0.0.x): Bug fixes

### Release Checklist

1. Update version in `package.json`
2. Update CHANGELOG.md
3. Test the build process
4. Create release notes
5. Tag the release
6. Publish to npm

## 💡 Getting Help

### Resources

- **GitHub Issues**: Report bugs and request features
- **Discussions**: Ask questions and share ideas
- **Documentation**: [smsdev.app](https://smsdev.app)

### Community Guidelines

- Be respectful and inclusive
- Help others when possible
- Follow the code of conduct
- Keep discussions on-topic

## 🏷️ Issue Labels

We use these labels to organize issues:

- `bug`: Something isn't working
- `enhancement`: New feature or request
- `documentation`: Documentation needs
- `good first issue`: Good for newcomers
- `help wanted`: Extra attention is needed
- `question`: Further information is requested

## 📋 Pull Request Template

When creating a pull request, please include:

```markdown
## Description
Brief description of changes

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Testing
- [ ] I have tested my changes
- [ ] I have added/updated tests
- [ ] All tests pass

## Documentation
- [ ] I have updated documentation
- [ ] I have added examples if needed

## Checklist
- [ ] My code follows the style guidelines
- [ ] I have performed a self-review
- [ ] My changes generate no new warnings
```

## 🎯 Areas for Contribution

We especially welcome contributions in these areas:

### High Priority
- **Test coverage improvements**
- **Performance optimizations**
- **Cross-platform compatibility**
- **Error handling improvements**

### Medium Priority
- **Additional CLI commands**
- **Framework integrations**
- **Documentation improvements**
- **Example applications**

### Low Priority
- **UI/UX enhancements**
- **Additional export formats**
- **Advanced configuration options**

## 📄 License

By contributing, you agree that your contributions will be licensed under the MIT License.

---

Thank you for contributing to sms-dev! 🎉 