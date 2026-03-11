# Convenções de Commit

## Formato Padrão
```
<tipo>(<escopo>): <descrição curta>

<corpo opcional - descrição detalhada>

<rodapé opcional - referências>
```

## Tipos Principais
- `feat`: Nova funcionalidade
- `fix`: Correção de bug
- `docs`: Mudanças em documentação
- `style`: Formatação, ponto e vírgula, etc (sem mudança de código)
- `refactor`: Refatoração de código
- `test`: Adição/correção de testes
- `chore`: Tarefas de build, configs, etc

## Exemplos
```bash
feat(auth): adiciona login com Google
fix(api): corrige timeout em requisições longas
docs(readme): atualiza instruções de instalação
chore(deps): atualiza dependências do projeto
```

## Boas Práticas
- Use o modo imperativo: "Add" não "Added"
- Descrição curta: máximo 50 caracteres
- Corpo: máximo 72 caracteres por linha
- Separe assunto do corpo com linha em branco