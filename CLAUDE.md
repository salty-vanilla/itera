@AGENTS.md

# Claude Code 固有

- Skill は `.claude/skills/`（`.agents/skills/` へのシンボリックリンク）から読み込まれる。新しい Skill は `.agents/skills/` に追加する。
- ファイルの場所ごとのルールは `.claude/rules/` にある（UI、ドメイン、正本文書）。
- ハーネスの subagent は `.claude/agents/` にある。受け入れは `harness-reviewer`、設計相談は `harness-planner`。受け入れを頼むときは fork ではなく新しいコンテキストで起動し、引き継ぎに必要な材料だけを渡す。
- ライブラリやフレームワークの API は Context7 MCP で現在の文書を確認してから使う。
- 個人用の上書きは `CLAUDE.local.md` と `.claude/settings.local.json` に置く（どちらも Git 管理外）。
