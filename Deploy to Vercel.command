#!/bin/zsh -l
# Double-click this file in Finder to deploy the chatbot to Vercel.
cd "$(dirname "$0")"
bash ./deploy-vercel.sh
echo ""
echo "Press Enter to close this window."
read
