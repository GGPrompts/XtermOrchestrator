#!/bin/bash

echo "🚀 Starting Standalone XTerm Orchestrator..."
echo ""
echo "📝 First time setup:"
echo "   - Claude will provide a login link when you first run 'claude'"
echo "   - Just follow the link to authenticate"
echo "   - The token will be saved automatically"
echo ""

# Check if docker is running
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker is not running. Please start Docker first."
    exit 1
fi

# Start the containers
docker-compose up -d

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Terminal orchestrator started successfully!"
    echo ""
    echo "🌐 Open http://localhost:8088 in your browser"
    echo "💻 Type 'claude' in the terminal to start Claude Code CLI"
    echo "📋 Type 'help' for orchestrator commands"
    echo ""
    echo "📊 View logs: docker-compose logs -f"
    echo "🛑 Stop: docker-compose down"
else
    echo "❌ Failed to start containers"
    echo "Check logs with: docker-compose logs"
fi