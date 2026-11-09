// Modo demonstração: classificação por regras simples, sem IA.
// Serve para o app funcionar mesmo sem chave da API (ex.: quem abre o link do portfólio).

function normalizar(texto) {
  return texto.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

const REGRAS = [
  { categoria: "Atraso na entrega", padroes: [/atras/, /demor/, /\b\d+ ?h\d*/, /\bhora\b/, /esperei/, /\btarde\b/] },
  { categoria: "Pedido errado ou incompleto", padroes: [/errad/, /faltou/, /faltando/, /veio sem/, /\bsem o\b/, /trocar/, /incomplet/, /esquec/, /outra pessoa/, /pedi sem/] },
  { categoria: "Temperatura", padroes: [/\bfri[oa]s?\b/, /gelad/, /derretid/, /\bmorn[oa]\b/, /veio quente/, /\bliquido\b/] },
  { categoria: "Pagamento", padroes: [/cobra(ram|nca)/, /duas vezes no cartao/, /estorno/, /\bpix\b/, /reembols/] },
  { categoria: "Embalagem", padroes: [/embalag/, /vazou/, /vazand/, /derram/, /amassad/, /tampa/] },
  { categoria: "Atendimento", padroes: [/atendiment/, /grosseir/, /mal educad/, /ninguem respond/, /entregador/] },
  { categoria: "Preço", padroes: [/\bcaro\b/, /preco/, /\btaxa\b/, /pouca comida/, /porcao pequena/, /pelo tamanho/] },
  { categoria: "Qualidade da comida", padroes: [/salgad/, /\bcrua?\b/, /queimad/, /sem gosto/, /requentad/, /murch/, /oleos/, /\bruim\b/] }
];

const POSITIVAS = [/otim/, /perfeit/, /parabens/, /melhor/, /gostos/, /delicios/, /nota 10/, /rapid/, /generos/, /quentinh/, /custo-beneficio/, /\bboa\b/, /\bbom\b/];
const NEGATIVAS = [/absurd/, /decepcion/, /nao peco mais/, /nao deu/, /pessim/, /horrivel/, /segunda vez/, /ninguem/];

function contar(texto, padroes) {
  return padroes.reduce((n, p) => n + (p.test(texto) ? 1 : 0), 0);
}

function classificarDemo(texto) {
  const t = normalizar(texto);

  // Todas as categorias encontradas, da que teve mais acertos para a que teve menos.
  const achadas = REGRAS
    .map(regra => ({ categoria: regra.categoria, n: contar(t, regra.padroes) }))
    .filter(r => r.n > 0)
    .sort((a, b) => b.n - a.n)
    .map(r => r.categoria);

  const pos = contar(t, POSITIVAS);
  const neg = contar(t, NEGATIVAS) + (achadas.length ? 1 : 0);

  let sentimento = "neutro";
  if (pos > neg) sentimento = "positivo";
  else if (neg > pos) sentimento = "negativo";

  const categorias = sentimento === "positivo" ? ["Elogio"] : (achadas.length ? achadas : ["Outro"]);

  let urgencia = "baixa";
  if (sentimento === "negativo") {
    urgencia = /crua?|errad|outra pessoa|segunda vez|nao peco mais|grosseir|cobra|paguei|\b[1-9] ?h|\buma hora|duas horas/.test(t) ? "alta" : "media";
  }

  return {
    categorias,
    sentimento,
    urgencia,
    resumo: "Classificado por regras (modo demonstração).",
    resposta: respostaModelo(categorias[0], sentimento)
  };
}

function respostaModelo(categoria, sentimento) {
  if (sentimento === "positivo") {
    return "Que alegria ler isso! Obrigado pelo carinho e pela avaliação. Esperamos você no próximo pedido!";
  }
  const modelos = {
    "Atraso na entrega": "Sentimos muito pela demora. Já estamos revendo nosso tempo de preparo nos horários de pico para que isso não se repita. Obrigado pela paciência!",
    "Pedido errado ou incompleto": "Pedimos desculpas pelo erro no seu pedido. Reforçamos a conferência antes do envio. Fale com a gente pelo chat que vamos resolver!",
    "Temperatura": "Que pena que seu pedido não chegou na temperatura certa. Vamos revisar a embalagem térmica e o tempo de despacho. Obrigado por avisar!",
    "Pagamento": "Sentimos muito pelo problema com o pagamento. Fale com a gente pelo chat do pedido para verificarmos.",
    "Qualidade da comida": "Obrigado pelo retorno sincero. Passamos sua avaliação para a cozinha e vamos ajustar o preparo.",
    "Embalagem": "Desculpe pelo transtorno com a embalagem. Já estamos testando lacres e recipientes mais seguros.",
    "Atendimento": "Sentimos muito pela experiência. Vamos conversar com a equipe e com a entrega sobre o ocorrido.",
    "Preço": "Obrigado pelo retorno! Vamos reavaliar porções e preços para entregar mais valor no seu pedido."
  };
  return modelos[categoria] || "Obrigado pela avaliação! Sua opinião nos ajuda a melhorar.";
}

const ACOES_MODELO = {
  "Atraso na entrega": "Revisar o tempo de preparo informado no app e reforçar a equipe nos horários de pico.",
  "Pedido errado ou incompleto": "Criar um checklist de conferência (itens, bebidas, observações) antes de lacrar o pedido.",
  "Temperatura": "Trocar por embalagens térmicas, separar quentes de gelados e despachar só com o entregador no local.",
  "Pagamento": "Conferir cobranças duplicadas no extrato diariamente e responder pedidos de estorno em até 24 h.",
  "Qualidade da comida": "Padronizar ficha técnica (sal, ponto da carne) e fazer prova antes do envio.",
  "Embalagem": "Usar potes com lacre para molhos e líquidos e testar o transporte.",
  "Atendimento": "Responder mensagens em até 10 minutos e alinhar a postura com a equipe de entrega.",
  "Preço": "Comparar porção e preço com concorrentes e testar um combo de melhor custo-benefício.",
  "Elogio": "Destacar os pratos elogiados no cardápio e pedir avaliação aos clientes satisfeitos.",
  "Outro": "Ler essas avaliações à mão para descobrir novos padrões."
};

function acoesDemo(contagem) {
  return Object.entries(contagem)
    .filter(([cat]) => cat !== "Elogio" && cat !== "Outro")
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([categoria]) => ({ categoria, acao: ACOES_MODELO[categoria] }));
}

if (typeof module !== "undefined") module.exports = { classificarDemo, acoesDemo, normalizar };
