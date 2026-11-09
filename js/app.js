// Interface: lê as avaliações, chama a IA (ou o modo demonstração) e desenha o painel.

const MINUTOS_MANUAIS_POR_AVALIACAO = 2;
const $ = (id) => document.getElementById(id);

const estado = { textos: [], resultados: [], acoes: [] };

// ---------- Configuração ----------
function lerConfig() {
  try {
    return {
      apiKey: localStorage.getItem("nc_chave") || "",
      modelo: localStorage.getItem("nc_modelo") || "gemini-3.8-flash"
    };
  } catch (_) {
    return { apiKey: $("chave").value.trim(), modelo: $("modelo").value.trim() || "gemini-3.8-flash" };
  }
}

function atualizarSelo() {
  const { apiKey } = lerConfig();
  const selo = $("selo-modo");
  selo.textContent = apiKey ? "IA ativa (Gemini)" : "Modo demonstração";
  selo.classList.toggle("ia", Boolean(apiKey));
}

$("salvar-config").addEventListener("click", () => {
  try {
    localStorage.setItem("nc_chave", $("chave").value.trim());
    localStorage.setItem("nc_modelo", $("modelo").value.trim() || "gemini-3.8-flash");
  } catch (_) {}
  atualizarSelo();
  mostrarStatus("Configuração salva.");
});

$("limpar-config").addEventListener("click", () => {
  try { localStorage.removeItem("nc_chave"); } catch (_) {}
  $("chave").value = "";
  atualizarSelo();
  mostrarStatus("Chave removida. Usando modo demonstração.");
});

// ---------- Entrada ----------
$("exemplos").addEventListener("click", () => {
  $("entrada").value = EXEMPLOS.join("\n");
  mostrarStatus(`${EXEMPLOS.length} avaliações de exemplo carregadas.`);
});

$("arquivo").addEventListener("change", async (e) => {
  const arquivo = e.target.files[0];
  if (!arquivo) return;
  const textos = lerCSV(await arquivo.text());
  if (!textos.length) return mostrarStatus("Não encontrei avaliações no CSV. Use uma coluna chamada 'texto'.", true);
  $("entrada").value = textos.join("\n");
  mostrarStatus(`${textos.length} avaliações importadas de ${arquivo.name}.`);
  e.target.value = "";
});

function lerCSV(conteudo) {
  const linhas = [];
  let campo = "", linha = [], aspas = false;
  for (let i = 0; i < conteudo.length; i++) {
    const c = conteudo[i];
    if (aspas) {
      if (c === '"' && conteudo[i + 1] === '"') { campo += '"'; i++; }
      else if (c === '"') aspas = false;
      else campo += c;
    } else if (c === '"') aspas = true;
    else if (c === "," || c === ";") { linha.push(campo); campo = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && conteudo[i + 1] === "\n") i++;
      linha.push(campo); linhas.push(linha); linha = []; campo = "";
    } else campo += c;
  }
  if (campo || linha.length) { linha.push(campo); linhas.push(linha); }

  const validas = linhas.filter(l => l.some(v => v.trim()));
  if (!validas.length) return [];
  const cabecalho = validas[0].map(v => normalizar(v.trim()));
  let col = cabecalho.findIndex(v => ["texto", "avaliacao", "comentario", "review"].includes(v));
  const dados = col === -1 ? validas : validas.slice(1);
  if (col === -1) col = 0;
  return dados.map(l => (l[col] || "").trim()).filter(Boolean);
}

// ---------- Análise ----------
$("analisar").addEventListener("click", analisar);

async function analisar() {
  const textos = $("entrada").value.split("\n").map(t => t.trim()).filter(Boolean);
  if (!textos.length) return mostrarStatus("Cole pelo menos uma avaliação ou carregue os exemplos.", true);

  const botao = $("analisar");
  botao.disabled = true;
  const { apiKey, modelo } = lerConfig();
  const inicio = performance.now();

  try {
    let resultados, acoes;
    if (apiKey) {
      ({ resultados, acoes } = await analisarComGemini(textos, { apiKey, modelo, aoProgredir: mostrarStatus }));
    } else {
      resultados = textos.map(classificarDemo);
      acoes = acoesDemo(agrupar(resultados, textos).contagem);
    }

    const segundos = (performance.now() - inicio) / 1000;
    Object.assign(estado, { textos, resultados, acoes });
    desenharPainel(segundos);
    desenharLista();
    mostrarStatus(`Pronto! ${textos.length} avaliações analisadas em ${segundos.toFixed(1)} s${apiKey ? "" : " (modo demonstração)"}.`);
    $("painel").scrollIntoView({ behavior: "smooth" });
  } catch (erro) {
    mostrarStatus(erro.message || "Algo deu errado.", true);
  } finally {
    botao.disabled = false;
  }
}

function agrupar(resultados, textos) {
  const contagem = {}, exemplos = {};
  // Uma avaliação pode contar em mais de uma categoria.
  resultados.forEach((r, i) => r.categorias.forEach(c => {
    contagem[c] = (contagem[c] || 0) + 1;
    (exemplos[c] ||= []).push(textos[i]);
  }));
  return { contagem, exemplos };
}

// ---------- Painel ----------
function desenharPainel(segundos) {
  const { resultados, acoes, textos } = estado;
  const total = resultados.length;
  const negativas = resultados.filter(r => r.sentimento === "negativo").length;
  const urgentes = resultados.filter(r => r.urgencia === "alta").length;
  const minutos = Math.max(0, total * MINUTOS_MANUAIS_POR_AVALIACAO - segundos / 60);

  $("k-total").textContent = total;
  $("k-neg").textContent = Math.round((negativas / total) * 100) + "%";
  $("k-urg").textContent = urgentes;
  $("k-tempo").textContent = Math.round(minutos) + " min";
  $("k-duracao").textContent = segundos.toFixed(1) + " s";

  const { contagem } = agrupar(resultados, textos);
  const ordenado = Object.entries(contagem).sort((a, b) => b[1] - a[1]);
  const maior = ordenado[0]?.[1] || 1;

  const grafico = $("grafico");
  grafico.replaceChildren(...ordenado.map(([cat, n]) => {
    const barra = el("div", { class: "barra" + (cat === "Elogio" ? " elogio" : ""), role: "listitem", "aria-label": `${cat}: ${n}` });
    const trilho = el("div", { class: "barra-trilho" });
    const cheia = el("div", { class: "barra-cheia" });
    cheia.style.width = (n / maior) * 100 + "%";
    trilho.append(cheia);
    barra.append(el("span", {}, cat), trilho, el("span", { class: "barra-num" }, String(n)));
    return barra;
  }));

  // A contagem vem do código, nunca da IA (modelos de linguagem erram contas).
  const acoesContadas = acoes
    .filter(a => contagem[a.categoria])
    .sort((a, b) => contagem[b.categoria] - contagem[a.categoria]);
  const lista = $("lista-acoes");
  lista.replaceChildren(...(acoesContadas.length
    ? acoesContadas.map(a => {
        const n = contagem[a.categoria];
        const li = el("li");
        li.append(
          el("strong", {}, `${a.categoria} · ${n} ${n > 1 ? "avaliações" : "avaliação"}`),
          document.createTextNode(semContagem(a.acao))
        );
        return li;
      })
    : [el("li", {}, "Nenhum problema recorrente. Continue assim!")]));

  const filtro = $("filtro");
  filtro.replaceChildren(el("option", { value: "" }, "Todas as categorias"),
    ...ordenado.map(([cat, n]) => el("option", { value: cat }, `${cat} (${n})`)));

  $("painel").hidden = false;
  $("secao-lista").hidden = false;
}

// ---------- Lista de avaliações ----------
$("filtro").addEventListener("change", desenharLista);

function desenharLista() {
  const filtro = $("filtro").value;
  const ordemUrg = { alta: 0, media: 1, baixa: 2 };
  const itens = estado.resultados
    .map((r, i) => ({ ...r, texto: estado.textos[i], indice: i }))
    .filter(r => !filtro || r.categorias.includes(filtro))
    .sort((a, b) => ordemUrg[a.urgencia] - ordemUrg[b.urgencia]);

  $("lista").replaceChildren(...itens.map(r => {
    const cartao = el("article", { class: `avaliacao ${r.sentimento}` });
    const etiquetas = el("div", { class: "etiquetas" });
    etiquetas.append(
      ...r.categorias.map(c => el("span", { class: "etiqueta" }, c)),
      el("span", { class: `etiqueta ${r.sentimento}` }, r.sentimento),
      el("span", { class: `etiqueta urg-${r.urgencia}` }, `urgência ${r.urgencia === "media" ? "média" : r.urgencia}`)
    );

    const idCampo = `resposta-${r.indice}`;
    const campo = el("textarea", { id: idCampo, rows: "3" });
    campo.value = r.resposta;
    campo.addEventListener("input", () => { estado.resultados[r.indice].resposta = campo.value; });

    const copiar = el("button", { class: "btn btn-sec" }, "Copiar resposta");
    copiar.addEventListener("click", async () => {
      try { await navigator.clipboard.writeText(campo.value); }
      catch (_) { campo.select(); document.execCommand("copy"); }
      copiar.textContent = "Copiado!";
      setTimeout(() => (copiar.textContent = "Copiar resposta"), 1500);
    });

    const acoes = el("div", { class: "acoes" });
    acoes.append(copiar);

    cartao.append(
      el("p", { class: "texto" }, `“${r.texto}”`),
      etiquetas,
      el("p", { class: "resumo" }, r.resumo),
      el("label", { for: idCampo, class: "sr" }, "Resposta sugerida"),
      campo,
      acoes
    );
    return cartao;
  }));
}

// ---------- Exportar ----------
$("exportar").addEventListener("click", () => {
  const cab = ["texto", "categorias", "sentimento", "urgencia", "resumo", "resposta"];
  const esc = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const linhas = estado.resultados.map((r, i) => [estado.textos[i], r.categorias.join("; "), r.sentimento, r.urgencia, r.resumo, r.resposta].map(esc).join(","));
  const blob = new Blob(["﻿" + [cab.join(","), ...linhas].join("\n")], { type: "text/csv;charset=utf-8" });
  const link = el("a", { href: URL.createObjectURL(blob), download: "avaliacoes-analisadas.csv" });
  document.body.append(link);
  link.click();
  link.remove();
});

// ---------- Utilidades ----------
// Remove contagens que a IA escreva mesmo sendo proibida (ex.: "Motivada por 11 avaliações, ").
function semContagem(texto) {
  const limpo = texto
    .replace(/\(?\b(motivad[oa]s?|citad[oa]s?|basead[oa]s?|apontad[oa]s?)?\s*(por|em)?\s*\d+\s+(avalia[çc][õo]es|reclama[çc][õo]es|relatos|clientes)[^,.;)]*\)?[,;]?\s*/gi, "")
    .replace(/\s*[,;]\s*([.!]|$)/g, "$1")
    .trim();
  return limpo.charAt(0).toUpperCase() + limpo.slice(1);
}

function el(tag, attrs = {}, texto) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  if (texto !== undefined) e.textContent = texto;
  return e;
}

function mostrarStatus(msg, erro = false) {
  const s = $("status");
  s.textContent = msg;
  s.classList.toggle("erro", erro);
}

// Início
(function iniciar() {
  const { apiKey, modelo } = lerConfig();
  $("chave").value = apiKey;
  $("modelo").value = modelo;
  atualizarSelo();
})();
