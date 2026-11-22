// "Don't melt this": spots pieces that are usually worth more sold as they are than as scrap gold,
// so they can be kept back from the refiner. Used by the offer screen and the Buy log.
(function(){
'use strict';
const RULES = [
  [/\b(half[\s-]*)?sovereigns?\b|\bbritannias?\b|\bkrugerrands?\b|\bmaple\s*leaf|\bphilharmonic|\bpandas?\b.*\bcoin|\beagles?\b.*\bcoin|\bguineas?\b|\bnapoleons?\b|\bcoins?\b|\bproof\b|\bboxed\s*set\b|\bmedals?\b|\bmedallions?\b/i,
   "Coins and medals usually sell to a coin dealer for more than their gold value, especially proofs, sets and older dates."],
  [/\brolex\b|\bomega\b|\bcartier\b|\btiffany\b|\bbu?lgari\b|\bbvlgari\b|\bvan\s*cleef\b|\bchopard\b|\bboodles\b|\bgraff\b|\bgeorg\s*jensen\b|\bherm[eè]s\b|\bchanel\b|\bdior\b|\bgucci\b|\bpiaget\b|\bpatek\b|\baudemars\b|\bbreitling\b|\bjaeger\b|\bdavid\s*yurman\b|\bmessika\b|\bpomellato\b|\bdesigner\b|\bsigned\b/i,
   "Designer and signed pieces can sell for well above scrap, especially with the box and papers."],
  [/\bantique\b|\bvictorian\b|\bedwardian\b|\bgeorgian\b|\bregency\b|\bart\s*deco\b|\bart\s*nouveau\b|\bvintage\b|\bmourning\b|\bcameo\b|\blocket\b.*\b(18|19)\d\d\b|\b1[6-8]\d\d\b|\b19[0-3]\d\b/i,
   "Antique and period pieces can be worth more to a dealer or auction than as scrap."],
  [/\bwatch(es)?\b/i, "Watches are usually worth more working and sold whole than melted for the gold."],
  [/\bdiamonds?\b|\bsapphires?\b|\brub(y|ies)\b|\bemeralds?\b|\bsolitaire\b|\bcarat\s*diamond\b|\b\d(\.\d+)?\s*ct\s*(diamond|stone)/i,
   "Check the stones: a decent diamond or gem can be worth more than the gold around it."]
];
window.keepReason = function(text, metal){
  const t = String(text || "") + " " + (metal === "Watch" ? "watch" : "");
  for (const [re, why] of RULES) if (re.test(t)) return why;
  return "";
};
})();
