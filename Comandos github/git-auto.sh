#!/bin/bash

# ========================================
# 🚀 Script Git Automatizado - Renov.Home
# ========================================

# Cores
VERDE='\033[0;32m'
AZUL='\033[0;34m'
AMARELO='\033[1;33m'
VERMELHO='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${AZUL}========================================${NC}"
echo -e "${AZUL}  🚀 Git Automatizado - Renov.Home${NC}"
echo -e "${AZUL}========================================${NC}"
echo ""

# Funções
acao_pull() {
    echo -e "${VERDE}📥 Fazendo Pull...${NC}"
    git pull
}

acao_push() {
    echo -e "${VERDE}📤 Fazendo Push...${NC}"
    git add .
    read -p "Digite a mensagem do commit: " msg
    if [ -n "$msg" ]; then
        git commit -m "$msg"
        git push
    else
        echo -e "${VERMELHO}❌ Mensagem vazia. Cancelado.${NC}"
    fi
}

acao_status() {
    echo -e "${VERDE}📊 Status do Repositório:${NC}"
    git status
}

acao_log() {
    echo -e "${VERDE}📜 Últimos Commits:${NC}"
    git lg -10
}

acao_branch() {
    echo -e "${VERDE}🌿 Branches:${NC}"
    git branch -a
}

acao_nova_branch() {
    read -p "Nome da nova branch: " nome
    if [ -n "$nome" ]; then
        git checkout -b "$nome"
        echo -e "${VERDE}✅ Branch '$nome' criada e você está nela${NC}"
    else
        echo -e "${VERMELHO}❌ Nome vazio. Cancelado.${NC}"
    fi
}

acao_mudar_branch() {
    read -p "Nome da branch: " nome
    if [ -n "$nome" ]; then
        git checkout "$nome"
    else
        echo -e "${VERMELHO}❌ Nome vazio. Cancelado.${NC}"
    fi
}

# Menu
echo "Escolha uma ação:"
echo ""
echo "1. 📥 Pull (baixar alterações)"
echo "2. 📤 Push (enviar alterações)"
echo "3. 📊 Status"
echo "4. 📜 Log (histórico)"
echo "5. 🌿 Listar Branches"
echo "6. ➕ Criar nova Branch"
echo "7. 🔄 Mudar de Branch"
echo "8. 🚪 Sair"
echo ""

read -p "Digite o número: " opcao

case $opcao in
    1) acao_pull ;;
    2) acao_push ;;
    3) acao_status ;;
    4) acao_log ;;
    5) acao_branch ;;
    6) acao_nova_branch ;;
    7) acao_mudar_branch ;;
    8) echo -e "${AZUL}Até logo! 👋${NC}" ;;
    *) echo -e "${VERMELHO}❌ Opção inválida${NC}" ;;
esac
