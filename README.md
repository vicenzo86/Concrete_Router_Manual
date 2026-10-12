# Concrete Router Manual

Programação diária de entregas de concreto. React + TypeScript + Vite, autenticação Supabase, mapas OpenStreetMap e tempos de viagem HERE.

## Alterações

- Bomba manual respeitada; horário travado significa a primeira descarga na obra.
- Frota manual preservada; conflitos são avisados em vermelho, sem reduzir silenciosamente a frota.
- Caminhões globais C-1, C-2 etc.; ciclos separados em carregamento, ida, descarga e retorno.
- Descargas sequenciais dentro da mesma obra; conflitos entre obras são sinalizados.
- Não inventa coordenadas ou tempos quando HERE falha; apresenta o erro.
- Exportação Excel identifica planos com conflitos.
- Modo automático é distribuição heurística, não otimização matemática.
- Compilação TypeScript corrigida, versões fixadas no lockfile e configuração Vercel incluída.

## Uso

1. Faça login com sua conta Supabase existente.
2. Informe sua chave HERE (ou configure VITE_HERE_API_KEY).
3. Importe uma planilha .xlsx com cabeçalhos `Cargas iniciais`, `Endereço` e, opcionalmente, `Coordenadas` no formato `-26.9,-48.6`.
4. Configure o início da operação como horário em que os caminhões podem começar a carregar.
5. No modo Manual, trave cada obra e defina bomba, frota e primeira descarga.
6. Gere a programação e revise os avisos vermelhos e as premissas.

Uma primeira descarga às 05:00 pode exigir carregar antes das 05:00. Nesse caso, antecipe o início da operação ou ajuste a primeira descarga. Horários manuais pertencem à data escolhida; para operar após a meia-noite, crie outro plano para o dia seguinte.

## Limites explícitos

Não modela capacidade simultânea de carregamento da usina, deslocamento/montagem/desmontagem das bombas, turnos, limite de idade do concreto ou rastreamento ao vivo. As bombas são consideradas disponíveis na obra quando começam a atender; confira sua logística separadamente. Os tempos HERE usam o horário inicial e não são atualizados para cada viagem. Rotas usam perfil truck sem dimensões específicas. O mapa mostra ligações diretas, não trajetos de rua. Volumes presumem cargas completas. Não há persistência de planos ou comparação automática D-1/D.

A alocação de caminhões é conservadora: reserva um grupo por obra; não garante achar todas as combinações possíveis. Conflitos preservam os horários solicitados para revisão; um plano com conflitos não é validado para execução.

## Local

Node.js 22 recomendado:

```sh
npm ci
npm test
npm run dev
```

Produção:

```sh
npm run build
npm run preview
```

## Vercel

1. Envie estes arquivos ao repositório Concrete_Router_Manual.
2. No Vercel, Add New → Project → importe esse repositório.
3. Framework: Vite; build: `npm run build`; saída: `dist`; diretório raiz: o do package.json.
4. VITE_HERE_API_KEY é opcional: sem ela, informe a chave no campo do app.
5. Supabase atual é mantido por padrão. Para outro projeto, configure VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY.
6. Clique Deploy.

Variáveis VITE_* são públicas no bundle do navegador. Use apenas a chave pública anon do Supabase; nunca service_role. Restrinja a chave HERE ao domínio permitido e substitua a chave anteriormente publicada no repositório original. Confirme no Supabase os URLs de Site/Redirect da implantação para confirmação de cadastro.

## Validação

`npm test` verifica horários/bombas fixados, frota preservada, etapas do ciclo, conflitos, entradas inválidas e distribuição automática. `npm run build` verifica TypeScript e cria a versão de produção. Autenticação e chamadas HERE devem ser testadas na implantação com suas credenciais.
