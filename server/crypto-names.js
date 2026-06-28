// Nome amigável de criptomoedas a partir do ticker (símbolo). O ticker é o próprio
// símbolo (ex.: BTC), aqui mapeamos para o nome completo (ex.: Bitcoin). Usado na
// importação Bybit (parseBybit) e no endpoint de holdings para preencher `nome`.
const CRYPTO_NAMES = {
  BTC: "Bitcoin",        ETH: "Ethereum",       SOL: "Solana",
  LINK: "Chainlink",     USDC: "USD Coin",      USDT: "Tether",
  BNB: "BNB",            XRP: "XRP",            ADA: "Cardano",
  DOGE: "Dogecoin",      MATIC: "Polygon",      POL: "Polygon",
  DOT: "Polkadot",       AVAX: "Avalanche",     TRX: "TRON",
  LTC: "Litecoin",       BCH: "Bitcoin Cash",   XLM: "Stellar",
  ATOM: "Cosmos",        UNI: "Uniswap",        ETC: "Ethereum Classic",
  FIL: "Filecoin",       APT: "Aptos",          ARB: "Arbitrum",
  OP: "Optimism",        NEAR: "NEAR Protocol", ALGO: "Algorand",
  VET: "VeChain",        ICP: "Internet Computer", HBAR: "Hedera",
  SAND: "The Sandbox",   MANA: "Decentraland",  AAVE: "Aave",
  EOS: "EOS",            XTZ: "Tezos",          THETA: "Theta Network",
  AXS: "Axie Infinity",  GRT: "The Graph",      SHIB: "Shiba Inu",
  PEPE: "Pepe",          WLD: "Worldcoin",      SUI: "Sui",
  SEI: "Sei",            INJ: "Injective",      TIA: "Celestia",
  RNDR: "Render",        IMX: "Immutable",      MKR: "Maker",
  FTM: "Fantom",         RUNE: "THORChain",     CAKE: "PancakeSwap",
  CRV: "Curve DAO",      LDO: "Lido DAO",       ENS: "Ethereum Name Service",
  DAI: "Dai",            BUSD: "Binance USD",   TON: "Toncoin",
};

// Nome amigável; se desconhecido, devolve o próprio ticker.
const cryptoName = sym => CRYPTO_NAMES[String(sym || "").toUpperCase().trim()] || sym;

module.exports = { CRYPTO_NAMES, cryptoName };
