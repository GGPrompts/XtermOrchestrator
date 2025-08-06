#!/bin/bash

# Extract Standalone XTerm Orchestrator from AI-Orchestrator project
# This script copies only the necessary files for the standalone terminal

echo "🚀 Extracting Standalone XTerm Orchestrator..."

SOURCE_DIR="/home/matt/projects/ai-orchestrator"
DEST_DIR="/home/matt/projects/standalone-xterm-orchestrator"

# Create directory structure
echo "📁 Creating directory structure..."
mkdir -p "$DEST_DIR"/{frontend,backend,docker}
mkdir -p "$DEST_DIR"/frontend/{src/pages,src/components,public}
mkdir -p "$DEST_DIR"/backend/{services,utils}

# Copy Backend Files
echo "📦 Copying backend files..."
cp "$SOURCE_DIR"/terminal-backend/package.json "$DEST_DIR"/backend/
cp "$SOURCE_DIR"/terminal-backend/server.js "$DEST_DIR"/backend/
cp "$SOURCE_DIR"/terminal-backend/services/TerminalManager.js "$DEST_DIR"/backend/services/
cp "$SOURCE_DIR"/terminal-backend/services/OrchestratorCommands.js "$DEST_DIR"/backend/services/
cp "$SOURCE_DIR"/terminal-backend/services/MessageRouter.js "$DEST_DIR"/backend/services/
cp "$SOURCE_DIR"/terminal-backend/utils/WebSocketUtils.js "$DEST_DIR"/backend/utils/

# Copy Frontend Files
echo "📦 Copying frontend files..."
cp "$SOURCE_DIR"/frontend/package.json "$DEST_DIR"/frontend/
cp "$SOURCE_DIR"/frontend/vite.config.ts "$DEST_DIR"/frontend/
cp "$SOURCE_DIR"/frontend/tsconfig.json "$DEST_DIR"/frontend/
cp "$SOURCE_DIR"/frontend/index.html "$DEST_DIR"/frontend/
cp "$SOURCE_DIR"/frontend/src/main.tsx "$DEST_DIR"/frontend/src/
cp "$SOURCE_DIR"/frontend/src/App.tsx "$DEST_DIR"/frontend/src/
cp "$SOURCE_DIR"/frontend/src/pages/OrchestratorTerminal.tsx "$DEST_DIR"/frontend/src/pages/
cp "$SOURCE_DIR"/frontend/src/pages/OrchestratorTerminal.module.css "$DEST_DIR"/frontend/src/pages/ 2>/dev/null || true

# Copy Docker Files
echo "🐳 Copying Docker configuration..."
cp "$SOURCE_DIR"/docker/Dockerfile.frontend "$DEST_DIR"/docker/
cp "$SOURCE_DIR"/docker/Dockerfile.terminal-backend "$DEST_DIR"/docker/

# Create simplified Dockerfiles
cat > "$DEST_DIR"/frontend/Dockerfile << 'EOF'
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
EXPOSE 3000
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0", "--port", "3000"]
EOF

cat > "$DEST_DIR"/backend/Dockerfile << 'EOF'
FROM node:20
WORKDIR /app
RUN apt-get update && apt-get install -y python3 make g++ build-essential
COPY package*.json ./
RUN npm install
# Install Claude CLI locally
RUN npm install @anthropic-ai/claude-code@latest
RUN mkdir -p /home/node/bin
RUN echo '#!/bin/bash\nexec /app/node_modules/.bin/claude "$@"' > /home/node/bin/claude
RUN chmod +x /home/node/bin/claude
COPY . .
EXPOSE 8126
CMD ["node", "server.js"]
EOF

# Create .gitignore
cat > "$DEST_DIR"/.gitignore << 'EOF'
node_modules/
dist/
build/
.env
.env.local
*.log
.DS_Store
workspaces/
claude-config/
EOF

# Create startup script
cat > "$DEST_DIR"/start.sh << 'EOF'
#!/bin/bash
echo "🚀 Starting Standalone XTerm Orchestrator..."
docker-compose up -d
echo "✅ Terminal available at http://localhost:3000"
echo "📝 View logs with: docker-compose logs -f"
EOF
chmod +x "$DEST_DIR"/start.sh

echo "✅ Extraction complete!"
echo ""
echo "📂 Standalone project created at: $DEST_DIR"
echo ""
echo "🚀 To start the standalone terminal:"
echo "   cd $DEST_DIR"
echo "   ./start.sh"
echo ""
echo "🌐 Then open http://localhost:3000 in your browser"
echo ""
echo "⚠️  Note: You may need to:"
echo "   1. Run 'npm install' in frontend/ and backend/ directories"
echo "   2. Set CLAUDE_CODE_OAUTH_TOKEN in docker-compose.yml"
echo "   3. Adjust volume mounts for your project directories"