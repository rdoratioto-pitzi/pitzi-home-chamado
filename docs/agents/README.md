# 🤖 Max - AI Development Coordinator

**Max** is your Co-CTO, Strategic Technical Advisor, and Full Stack Development Expert powered by OpenClaw.

---

## 🎯 What is Max?

Max is an AI agent that coordinates a virtual team of **18 world-class specialists** to help you:

- ✅ Review code and suggest improvements
- ✅ Debug complex issues
- ✅ Make architectural decisions
- ✅ Write production-ready code
- ✅ Provide strategic technical guidance

**Think of Max as:** Your always-available senior developer + CTO advisor.

---

## 📂 Documentation Structure
```
docs/agents/max/
├── SOUL.md           # Who Max is (identity, team, mission)
├── USER.md           # Who you are (Matheus, Renov context)
├── IDENTITY.md       # How Max operates (principles, standards)
├── TOOLS.md          # Max's capabilities (read, exec, write)
├── AGENTS.md         # System prompt (18 specialists)
└── config/
    └── renov/
        ├── PROJECT.md   # Renov business overview
        ├── STACK.md     # Technical stack details
        ├── PATTERNS.md  # Code patterns & best practices
        └── create-file.sh # Helper script for file creation
```

---

## 🚀 Quick Start

### 1. Access Max via Terminal
```bash
# From Renov.Home directory
npx openclaw agent --message "Your question here"
```

### 2. Access Max via Telegram (Coming Soon)
```
@RenovMaxBot /code analyze app-sidebar.tsx
```

---

## 💡 Common Use Cases

### Code Review
```bash
npx openclaw agent --message "Review client/src/components/TicketCard.tsx for improvements"
```

### Bug Fixing
```bash
npx openclaw agent --message "Fix JSX error in app-sidebar.tsx line 531"
```

### Architecture Decisions
```bash
npx openclaw agent --message "Should we use React Query or keep using Axios directly?"
```

### Create Components
```bash
npx openclaw agent --message "Create a FileUploadButton component with drag-drop, validation, and progress bar"
```

---

## 🧠 Max's Team (18 Specialists)

### Development Masters (12)
- Linus Torvalds (Linux, systems)
- Guido van Rossum (Python, clean code)
- Donald Knuth (algorithms)
- Brendan Eich (JavaScript)
- Anders Hejlsberg (TypeScript)
- Dan Abramov (React patterns)
- Kent C. Dodds (testing)
- And 5 more...

### Analysts (4)
- Architecture Analyst
- Security Analyst
- Performance Analyst
- UX Analyst

### Management (2)
- Technical PM
- DevOps Lead

---

## 🎯 Max's Core Principles

1. **Strategic First, Tactical Second** - Thinks about business impact, not just code
2. **Multi-Expert Consultation** - Cites which expert suggests what
3. **Production-Ready or Nothing** - No half-working solutions
4. **Honest About Tradeoffs** - Presents options, you decide
5. **Learn Your Patterns** - Adapts to Renov's existing code style

---

## 📖 Read the Full Docs

- **[SOUL.md](./max/SOUL.md)** - Max's identity and mission
- **[USER.md](./max/USER.md)** - Your context (Matheus/Renov)
- **[IDENTITY.md](./max/IDENTITY.md)** - How Max operates
- **[TOOLS.md](./max/TOOLS.md)** - Max's technical capabilities
- **[PROJECT.md](./max/config/renov/PROJECT.md)** - Renov business overview
- **[STACK.md](./max/config/renov/STACK.md)** - Technical stack
- **[PATTERNS.md](./max/config/renov/PATTERNS.md)** - Code standards

---

## 🔧 Configuration

Max is configured via:
- **OpenClaw Gateway:** `~/.openclaw/openclaw.json`
- **Workspace:** `/Users/macbookm2/Documents/Workspaces/Renov-Home2/Renov.Home`
- **Model:** Minimax M2.5 via OpenRouter
- **Agent Files:** `~/.openclaw/agents/main/`

---

## 📊 Performance Metrics

**Tests Conducted:**
- ✅ Test 1 (Code Analysis): 8.5/10
- ✅ Test 2 (Bug Fix with Workspace): 9.5/10
- ⚠️ Test 3 (Create Component): Failed (tool issue - being fixed)

**Cost Efficiency:**
- ~$0.0005 per complex query
- 100x+ cheaper than SaaS alternatives
- Pay only for LLM tokens used

---

## 🆚 Max vs Traditional AI

| Feature | Max (OpenClaw) | Generic ChatGPT |
|---------|----------------|-----------------|
| **Knows Renov** | ✅ Full context | ❌ No context |
| **Code Access** | ✅ Reads your files | ❌ Can't access |
| **Consistency** | ✅ Remembers decisions | ❌ Forgets |
| **Cost** | ✅ $0-5/month | ⚠️ $20+/month |
| **Customization** | ✅ Fully customizable | ❌ Fixed |
| **Expertise** | ✅ 18 specialists | ⚠️ Generic |

---

## 🔮 Roadmap

- [x] Core personality and knowledge base
- [x] Workspace integration (reads Renov.Home code)
- [ ] Fix write tool (create files reliably)
- [ ] Telegram bot integration
- [ ] Automated code review on PRs
- [ ] Proactive vulnerability scanning
- [ ] Weekly architectural insights

---

## 🤝 Working with Max

**Max is here to:**
- Amplify your capabilities
- Make you a better CTO
- Save you time and reduce bugs
- Teach you along the way

**Max is NOT:**
- A replacement for human judgment
- Infallible (always review suggestions)
- Able to make business decisions for you

**Use Max for:** Technical excellence, strategic guidance, code quality  
**Rely on yourself for:** Business strategy, final decisions, team leadership

---

## 📞 Support

**Issues with Max?**
1. Check [TROUBLESHOOTING.md](./max/TOOLS.md) (tools limitations section)
2. Review OpenClaw logs: `~/.openclaw/logs/gateway.log`
3. Restart gateway: `npx openclaw gateway stop && npx openclaw gateway --port 18789 &`

**Want to improve Max?**
- Edit `~/.openclaw/workspace/AGENTS.md` to refine behavior
- Update `USER.md` with new context about Renov
- Add patterns to `PATTERNS.md`

---

**Max is evolving.** The more you use him, the better he gets at understanding Renov and your needs. 🚀
