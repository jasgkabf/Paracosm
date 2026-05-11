# Paracosm Agent

A full-stack AI agent platform with a unique CSE (Construct-Simulate-Execute) paradigm, world model engine, persona mesh, strategy genome, and real-time heartbeat monitoring.

## Architecture

```
Paracosm (CSE Paradigm)
  Construct -> Simulate -> Execute -> Reflect -> Evolve

  World Model Engine    - Structured entity graph, timeline, constraints, goals
  Persona Mesh Engine   - Multi-perspective internal debate (Architect/Executor/Critic/Dreamer/Curator)
  Simulation Engine     - Monte Carlo Tree Search, path exploration, risk analysis
  Strategy Genome       - Genetic evolution of problem-solving strategies
  Heartbeat Engine      - Real-time system health monitoring with PQRST ECG waveform
  LLM Gateway           - OpenAI-compatible API, custom LLM support, smart routing
  Memory System         - Working/short-term/long-term/episodic/semantic + vector store
  Tool System           - 7 built-in tools (file/shell/system/web/code/api/data), plugin, MCP
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | Node.js + TypeScript + Fastify |
| LLM Gateway | OpenAI-compatible API with function calling |
| Frontend | Next.js + React + TailwindCSS |
| CLI | Commander.js + Ink (React for CLI) |
| State | Zustand |
| Monorepo | pnpm workspace + Turborepo |
| Container | Docker + Docker Compose |

## Quick Start

### One-Command Deploy (Linux / macOS)

```bash
git clone https://github.com/jasgkabf/Paracosm.git && cd Paracosm && bash scripts/quick-start.sh
```

### One-Command Deploy (Windows PowerShell)

```powershell
git clone https://github.com/jasgkabf/Paracosm.git; cd Paracosm; .\scripts\quick-start.ps1
```

### Docker One-Command Deploy (Any Platform)

```bash
git clone https://github.com/jasgkabf/Paracosm.git && cd Paracosm && docker compose -f docker/docker-compose.yml up -d
```

Access: `http://your-server-ip:7529`

---

## Detailed Installation

### Prerequisites

- Node.js >= 20.0.0
- pnpm >= 9.0.0
- Git

### Step-by-Step

```bash
# 1. Clone the repository
git clone https://github.com/jasgkabf/Paracosm.git
cd Paracosm

# 2. Install dependencies
pnpm install

# 3. Build all packages
pnpm build

# 4. Start the server (API + Web on port 7529)
pnpm dev
```

Access: `http://localhost:7529`

### LLM Configuration

After starting the server, open `http://your-ip:7529` in your browser:

1. Go to **Settings** page
2. Enter your LLM configuration:
   - **API Key** — Your API key (e.g. `tp-xxxxx`)
   - **Base URL** — Your API endpoint (e.g. `https://api.openai.com/v1`)
   - **Model** — Model name (e.g. `gpt-4o`, `MiMo-V2.5-Pro`)
3. Click **Test Connection** to verify
4. Click **Save**

Any OpenAI-compatible API is supported.

### CLI Usage

```bash
# Install CLI globally
pnpm --filter @paracosm/cli link --global

# Start interactive chat
paracosm chat

# Start server
paracosm serve --port 7529

# Configure LLM providers
paracosm config init

# Check system status
paracosm status

# Diagnose issues
paracosm doctor
```

---

## Platform-Specific Deployment

### Linux (Ubuntu/Debian) - One Command

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash - && \
sudo apt-get install -y nodejs && \
npm install -g pnpm && \
git clone https://github.com/jasgkabf/Paracosm.git && cd Paracosm && \
pnpm install && pnpm build && pnpm dev
```

### Linux (CentOS/RHEL) - One Command

```bash
curl -fsSL https://rpm.nodesource.com/setup_20.x | sudo bash - && \
sudo yum install -y nodejs && \
npm install -g pnpm && \
git clone https://github.com/jasgkabf/Paracosm.git && cd Paracosm && \
pnpm install && pnpm build && pnpm dev
```

### macOS - One Command

```bash
brew install node@20 pnpm && \
git clone https://github.com/jasgkabf/Paracosm.git && cd Paracosm && \
pnpm install && pnpm build && pnpm dev
```

### Windows - One Command (PowerShell)

```powershell
npm install -g pnpm; git clone https://github.com/jasgkabf/Paracosm.git; cd Paracosm; pnpm install; pnpm build; pnpm dev
```

### Docker (Any Platform) - One Command

```bash
cd Paracosm && docker compose -f docker/docker-compose.yml up -d
```

### Docker Build from Source

```bash
docker build -t paracosm -f docker/Dockerfile .
docker run -d -p 7529:7529 -v paracosm-data:/app/data paracosm
```

---

## Server Deployment (Production)

### Deploy to Cloud Server (One Command)

```bash
# On your server (requires Docker)
git clone https://github.com/jasgkabf/Paracosm.git /opt/paracosm && cd /opt/paracosm && \
docker compose -f docker/docker-compose.yml up -d && \
echo "Paracosm running at http://$(hostname -I | awk '{print $1}'):7529"
```

### With Environment Variables

```bash
# Create .env file
cat > .env << 'EOF'
PARACOSM_PORT=7529
PARACOSM_HOST=0.0.0.0
PARACOSM_NODE_ENV=production
EOF

# Start with env
docker compose --env-file .env up -d
```

### Nginx Reverse Proxy

```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://127.0.0.1:7529;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

### Systemd Service (Linux)

```bash
# /etc/systemd/system/paracosm.service
cat > /etc/systemd/system/paracosm.service << 'EOF'
[Unit]
Description=Paracosm Agent
After=network.target

[Service]
Type=simple
User=paracosm
WorkingDirectory=/opt/paracosm
ExecStart=/usr/bin/pnpm start
Restart=always
RestartSec=10
Environment=NODE_ENV=production
Environment=PORT=7529

[Install]
WantedBy=multi-user.target
EOF

systemctl enable paracosm && systemctl start paracosm
```

---

## Project Structure

```
Paracosm/
  packages/
    shared/          Types, utils, constants (shared across all packages)
    core/            Core engines (world-model, persona-mesh, simulation, strategy, orchestrator, tools, memory, heartbeat)
    llm-gateway/     LLM gateway (providers, router, middleware, fallback, custom LLM)
    api/             REST + WebSocket API (Fastify, port 7529) + Agent Engine
    web/             Web frontend (Next.js + React + TailwindCSS)
    cli/             CLI (Commander + Ink)
  docker/            Docker configuration
  scripts/           Build and deployment scripts
```

## Core Features

| Feature | Description |
|---------|-------------|
| CSE Paradigm | Construct-Simulate-Execute-Reflect-Evolve cycle |
| Agent Engine | Real AI agent with OpenAI function calling and tool execution |
| World Model | Structured entity graph with timeline, constraints, goals |
| Persona Mesh | Multi-perspective debate (5 built-in personas) |
| Simulation | MCTS path exploration with risk analysis |
| Strategy Genome | Genetic evolution of problem-solving strategies |
| Heartbeat | Real-time PQRST ECG waveform monitoring |
| LLM Gateway | OpenAI-compatible API with any provider |
| Custom LLM | Configure API Key + Base URL + Model name |
| Memory | Multi-tier memory with vector and graph stores |
| Tools | 7 built-in (file/shell/system/web/code/api/data) + plugin + MCP |
| i18n | Chinese / English language switching |

## Default Port

Port **7529** (chosen to avoid conflicts with common ports like 3000, 8080, etc.)

## License

See LICENSE file.
