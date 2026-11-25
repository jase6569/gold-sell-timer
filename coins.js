/* Dorset Gold & Jewellery: coins, shared by Gold Trader and the Shop app.
   The full catalogue (official mint weights, sizes and fineness of every gold and silver coin and set),
   Look up a coin, Identify a coin (by weight and size) and Scan with camera (AI reads the coins, the sums come from the catalogue).
   The page that loads this provides: $, esc, store, fmt, OZ, fetchJSON, gbpPerGram, mmOn(), payRatio(), refinerG(k),
   and the coin markup (#coinTabs, #coinSel, #coinOut, ...). If it also provides coinBuy(lines), a "Buy these" button appears. */
/* =============== coins: look up and identify (gold and silver) =============== */
// Official mint specs: weight g, diameter mm, fineness. p = worth more than melt?
//   0 melt only · 1 bullion: coin dealers often pay a little over melt · 2 depends on date/condition: look it up · 3 usually well over melt: don't scrap
// fam groups coins that weigh the same but differ in metal by date, so the identifier can ask for the date.
const SV = (n, w, d, era, f, p, y, fam) => ({m: f ? "ag" : "cn", g: "UK silver (pre-1947)", n: `${n} (${era})`, w, d, f, p, y, fam});
const COINS = [
  // ---- UK gold ----
  {m: "au", g: "UK gold", n: "Sovereign (full)", w: 7.98805, d: 22.05, f: 0.9167, p: 2, y: "1817 to today"},
  {m: "au", g: "World gold", n: "Saudi gold guinea (same gold as a sovereign)", w: 7.988, d: 21.00, f: 0.9167, p: 1, y: "1947 to 1954"},
  {m: "au", g: "UK gold", n: "Half sovereign", w: 3.99405, d: 19.30, f: 0.9167, p: 2, y: "1817 to today"},
  {m: "au", g: "UK gold", n: "Quarter sovereign", w: 1.997, d: 13.50, f: 0.9167, p: 1, y: "2009 to today"},
  {m: "au", g: "UK gold", n: "Double sovereign (£2)", w: 15.976, d: 28.40, f: 0.9167, p: 2, y: "mostly 1980 onwards"},
  {m: "au", g: "UK gold", n: "Five sovereign piece (£5)", w: 39.94, d: 36.00, f: 0.9167, p: 2, y: "mostly 1980 onwards"},
  {m: "au", g: "UK gold", n: "Britannia 1oz (22ct, 1987–2012)", w: 34.05, d: 32.69, f: 0.9167, p: 1, y: "1987 to 2012"},
  {m: "au", g: "UK gold", n: "Britannia 1/2oz (22ct, 1987–2012)", w: 17.025, d: 27.00, f: 0.9167, p: 1, y: "1987 to 2012"},
  {m: "au", g: "UK gold", n: "Britannia 1/4oz (22ct, 1987–2012)", w: 8.5125, d: 22.00, f: 0.9167, p: 1, y: "1987 to 2012"},
  {m: "au", g: "UK gold", n: "Britannia 1/10oz (22ct, 1987–2012)", w: 3.405, d: 16.50, f: 0.9167, p: 1, y: "1987 to 2012"},
  {m: "au", g: "UK gold", n: "Britannia 1oz (24ct, 2013 only)", w: 31.21, d: 38.61, f: 0.9999, p: 1, y: "2013"},
  {m: "au", g: "UK gold", n: "Royal Mint 1oz 24ct (Britannia 2014+, Queen's Beasts, Lunar, Tudor Beasts, Myths & Legends)", w: 31.21, d: 32.69, f: 0.9999, p: 1, y: "2014 to today"},
  {m: "au", g: "UK gold", n: "Britannia 1/2oz (24ct)", w: 15.60, d: 27.00, f: 0.9999, p: 1, y: "2013 to today"},
  {m: "au", g: "UK gold", n: "Britannia 1/4oz (24ct)", w: 7.86, d: 22.00, f: 0.9999, p: 1, y: "2013 to today"},
  {m: "au", g: "UK gold", n: "Britannia 1/10oz (24ct)", w: 3.13, d: 16.50, f: 0.9999, p: 1, y: "2013 to today"},
  {m: "au", g: "UK gold", n: "Guinea (pre-1814)", w: 8.385, d: 24.5, f: 0.9167, p: 3, y: "1663 to 1814"},
  {m: "au", g: "UK gold", n: "Half guinea (pre-1814)", w: 4.19, d: 21.0, f: 0.9167, p: 3, y: "1669 to 1813"},
  {m: "au", g: "UK gold", n: "Third guinea (seven shillings, George III)", w: 2.78, d: 17.0, f: 0.9167, p: 3, y: "1797 to 1813"},
  {m: "au", g: "UK gold", n: "Quarter guinea", w: 2.10, d: 16.0, f: 0.9167, p: 3, y: "1718 and 1762 only"},
  {m: "au", g: "UK gold", n: "Two guineas", w: 16.77, d: 32.0, f: 0.9167, p: 3, y: "1664 to 1753"},
  {m: "au", g: "UK gold", n: "Five guineas", w: 41.75, d: 37.0, f: 0.9167, p: 3, y: "1668 to 1753"},
  // ---- world gold ----
  {m: "au", g: "World gold", n: "Krugerrand 1oz", w: 33.93, d: 32.77, f: 0.9167, p: 1, y: "1967 to today"},
  {m: "au", g: "World gold", n: "Krugerrand 1/2oz", w: 16.965, d: 27.07, f: 0.9167, p: 1, y: "1980 to today"},
  {m: "au", g: "World gold", n: "Krugerrand 1/4oz", w: 8.482, d: 22.06, f: 0.9167, p: 1, y: "1980 to today"},
  {m: "au", g: "World gold", n: "Krugerrand 1/10oz", w: 3.393, d: 16.55, f: 0.9167, p: 1, y: "1980 to today"},
  {m: "au", g: "World gold", n: "American Eagle 1oz", w: 33.93, d: 32.70, f: 0.9167, p: 1, y: "1986 to today"},
  {m: "au", g: "World gold", n: "American Eagle 1/2oz", w: 16.97, d: 27.00, f: 0.9167, p: 1, y: "1986 to today"},
  {m: "au", g: "World gold", n: "American Eagle 1/4oz", w: 8.48, d: 22.00, f: 0.9167, p: 1, y: "1986 to today"},
  {m: "au", g: "World gold", n: "American Eagle 1/10oz", w: 3.39, d: 16.50, f: 0.9167, p: 1, y: "1986 to today"},
  {m: "au", g: "World gold", n: "American Buffalo 1oz", w: 31.10, d: 32.70, f: 0.9999, p: 1, y: "2006 to today"},
  {m: "au", g: "World gold", n: "US $20 Double Eagle (pre-1934)", w: 33.436, d: 34.00, f: 0.900, p: 2, y: "1850 to 1933"},
  {m: "au", g: "World gold", n: "US $10 Eagle (pre-1934)", w: 16.718, d: 27.00, f: 0.900, p: 2, y: "1838 to 1933"},
  {m: "au", g: "World gold", n: "US $5 Half Eagle (pre-1930)", w: 8.359, d: 21.60, f: 0.900, p: 2, y: "1839 to 1929"},
  {m: "au", g: "World gold", n: "Maple Leaf 1oz", w: 31.11, d: 30.00, f: 0.9999, p: 1, y: "1979 to today"},
  {m: "au", g: "World gold", n: "Maple Leaf 1/2oz", w: 15.55, d: 25.00, f: 0.9999, p: 1, y: "1986 to today"},
  {m: "au", g: "World gold", n: "Maple Leaf 1/4oz", w: 7.78, d: 20.00, f: 0.9999, p: 1, y: "1986 to today"},
  {m: "au", g: "World gold", n: "Maple Leaf 1/10oz", w: 3.13, d: 16.00, f: 0.9999, p: 1, y: "1982 to today"},
  {m: "au", g: "World gold", n: "Philharmonic 1oz", w: 31.10, d: 37.00, f: 0.9999, p: 1, y: "1989 to today"},
  {m: "au", g: "World gold", n: "Philharmonic 1/2oz", w: 15.55, d: 28.00, f: 0.9999, p: 1, y: "1989 to today"},
  {m: "au", g: "World gold", n: "Philharmonic 1/4oz", w: 7.78, d: 22.00, f: 0.9999, p: 1, y: "1989 to today"},
  {m: "au", g: "World gold", n: "Philharmonic 1/10oz", w: 3.12, d: 16.00, f: 0.9999, p: 1, y: "1991 to today"},
  {m: "au", g: "World gold", n: "Austria 100 Corona (1915 restrike)", w: 33.875, d: 37.00, f: 0.900, p: 1, y: "dated 1915"},
  {m: "au", g: "World gold", n: "Austria 20 Corona (1915 restrike)", w: 6.775, d: 21.00, f: 0.900, p: 1, y: "dated 1915"},
  {m: "au", g: "World gold", n: "Austria 10 Corona (1912 restrike)", w: 3.3875, d: 19.00, f: 0.900, p: 1, y: "dated 1912"},
  {m: "au", g: "World gold", n: "Austria 4 Ducat (1915 restrike)", w: 13.964, d: 39.50, f: 0.986, p: 1, y: "dated 1915"},
  {m: "au", g: "World gold", n: "Austria 1 Ducat (1915 restrike)", w: 3.4909, d: 19.75, f: 0.986, p: 1, y: "dated 1915"},
  {m: "au", g: "World gold", n: "Kangaroo / Nugget 1oz", w: 31.11, d: 32.10, f: 0.9999, p: 1, y: "1987 to today"},
  {m: "au", g: "World gold", n: "Kangaroo / Nugget 1/2oz", w: 15.55, d: 25.10, f: 0.9999, p: 1, y: "1987 to today"},
  {m: "au", g: "World gold", n: "Kangaroo / Nugget 1/4oz", w: 7.78, d: 20.10, f: 0.9999, p: 1, y: "1987 to today"},
  {m: "au", g: "World gold", n: "Kangaroo / Nugget 1/10oz", w: 3.11, d: 16.10, f: 0.9999, p: 1, y: "1987 to today"},
  {m: "au", g: "World gold", n: "China Panda 30g", w: 30.00, d: 32.00, f: 0.999, p: 1, y: "2016 to today"},
  {m: "au", g: "World gold", n: "China Panda 15g", w: 15, d: 27.00, f: 0.999, p: 1, y: "2016 to today"},
  {m: "au", g: "World gold", n: "China Panda 8g", w: 8, d: 22.00, f: 0.999, p: 1, y: "2016 to today"},
  {m: "au", g: "World gold", n: "China Panda 3g", w: 3, d: 18.00, f: 0.999, p: 1, y: "2016 to today"},
  {m: "au", g: "World gold", n: "China Panda 1g", w: 1, d: 10.00, f: 0.999, p: 1, y: "2016 to today"},
  {m: "au", g: "World gold", n: "China Panda 1oz", w: 31.10, d: 32.00, f: 0.999, p: 1, y: "1982 to 2015"},
  {m: "au", g: "World gold", n: "Mexico 50 Pesos", w: 41.666, d: 37.00, f: 0.900, p: 1, y: "1921 to 1947 and restrikes"},
  {m: "au", g: "World gold", n: "Mexico 20 Pesos", w: 16.666, d: 27.50, f: 0.900, p: 1, y: "1917 to 1959"},
  {m: "au", g: "World gold", n: "Mexico 10 Pesos", w: 8.3333, d: 22.50, f: 0.900, p: 1, y: "1905 to 1972 (restrikes dated 1959)"},
  {m: "au", g: "World gold", n: "Mexico 5 Pesos", w: 4.1666, d: 19.00, f: 0.900, p: 1, y: "1905 to 1972 (restrikes dated 1955)"},
  {m: "au", g: "World gold", n: "Mexico 2½ Pesos", w: 2.0833, d: 15.50, f: 0.900, p: 1, y: "1918 to 1972 (restrikes dated 1945)"},
  {m: "au", g: "World gold", n: "Mexico 2 Pesos", w: 1.6666, d: 13.00, f: 0.900, p: 1, y: "1919 to 1972 (restrikes dated 1945)"},
  {m: "au", g: "World gold", n: "20 Francs / 20 Lire (French Napoleon, Swiss Vreneli, Belgian, Italian)", w: 6.4516, d: 21.00, f: 0.900, p: 2, y: "1800s to 1930s"},
  {m: "au", g: "World gold", n: "10 Francs (French Napoleon / Marianne, Swiss Vreneli)", w: 3.2258, d: 19.00, f: 0.900, p: 1, y: "1850s to 1922"},
  {m: "au", g: "World gold", n: "US $2.50 Quarter Eagle (pre-1930)", w: 4.18, d: 18.00, f: 0.900, p: 2, y: "1796 to 1929"},
  {m: "au", g: "World gold", n: "Russia 10 Roubles chervonets (Sower)", w: 8.6026, d: 22.60, f: 0.900, p: 1, y: "1923, 1975 to 1982"},
  {m: "au", g: "World gold", n: "Germany 20 Mark", w: 7.965, d: 22.50, f: 0.900, p: 2, y: "1871 to 1915"},
  {m: "au", g: "World gold", n: "Netherlands 10 Guilder", w: 6.729, d: 22.50, f: 0.900, p: 1, y: "1875 to 1933"},
  {m: "au", g: "World gold", n: "Turkey 100 Kurush (Ata / Monogram)", w: 7.216, d: 22.00, f: 0.9167, p: 1, y: "1920s to today"},
  {m: "au", g: "World gold", n: "Turkey 50 Kurush", w: 3.608, d: 18.00, f: 0.9167, p: 1, y: "1920s to today"},
  {m: "au", g: "World gold", n: "Turkey 25 Kurush", w: 1.804, d: 15.00, f: 0.9167, p: 1, y: "1920s to today"},
  // ---- modern UK coins: the same design is struck in base metal, silver and gold, and base and silver weigh the same ----
  {m: "cn", g: "UK crowns (25p and £5, 1972 to today)", n: "£5 crown (standard / brilliant uncirculated, cupronickel)", w: 28.28, d: 38.61, f: 0, p: 0, y: "1990 to today", fam: "crown5"},
  {m: "ag", g: "UK crowns (25p and £5, 1972 to today)", n: "£5 crown (silver proof, 92.5%)", w: 28.28, d: 38.61, f: 0.925, p: 2, y: "1990 to today", fam: "crown5"},
  {m: "ag", g: "UK crowns (25p and £5, 1972 to today)", n: "£5 crown (silver piedfort, double thickness)", w: 56.56, d: 38.61, f: 0.925, p: 2, y: "1990 to today"},
  {m: "au", g: "UK crowns (25p and £5, 1972 to today)", n: "£5 crown (gold proof, 22ct)", w: 39.94, d: 38.61, f: 0.9167, p: 3, y: "1990 to today"},
  {m: "cn", g: "UK crowns (25p and £5, 1972 to today)", n: "25p crown (cupronickel, 1972–1981)", w: 28.28, d: 38.61, f: 0, p: 0, y: "1972 to 1981", fam: "crown5"},
  {m: "ag", g: "UK crowns (25p and £5, 1972 to today)", n: "25p crown (silver proof, 92.5%, 1972–1981)", w: 28.28, d: 38.61, f: 0.925, p: 2, y: "1972 to 1981", fam: "crown5"},
  {m: "cn", g: "UK £2, £1 and 50p", n: "£2 two-coloured (standard)", w: 12.0, d: 28.4, f: 0, p: 2, y: "1997 to today", fam: "two"},
  {m: "ag", g: "UK £2, £1 and 50p", n: "£2 two-coloured (silver proof, 92.5%)", w: 12.0, d: 28.4, f: 0.925, p: 2, y: "1997 to today", fam: "two"},
  {m: "au", g: "UK £2, £1 and 50p", n: "£2 two-coloured (gold proof, 22ct)", w: 15.97, d: 28.4, f: 0.9167, p: 2, y: "1997 to today"},
  {m: "cn", g: "UK £2, £1 and 50p", n: "£1 round (standard, 1983–2016)", w: 9.5, d: 22.5, f: 0, p: 0, y: "1983 to 2016", fam: "one"},
  {m: "ag", g: "UK £2, £1 and 50p", n: "£1 round (silver proof, 92.5%)", w: 9.5, d: 22.5, f: 0.925, p: 2, y: "1983 to 2016", fam: "one"},
  {m: "au", g: "UK £2, £1 and 50p", n: "£1 round (gold proof, 22ct)", w: 19.62, d: 22.5, f: 0.9167, p: 2, y: "1983 to 2016"},
  {m: "cn", g: "UK £2, £1 and 50p", n: "50p (standard, cupronickel)", w: 8.0, d: 27.3, f: 0, p: 2, y: "1997 to today", fam: "fifty"},
  {m: "ag", g: "UK £2, £1 and 50p", n: "50p (silver proof, 92.5%)", w: 8.0, d: 27.3, f: 0.925, p: 2, y: "1997 to today", fam: "fifty"},
  {m: "au", g: "UK £2, £1 and 50p", n: "50p (gold proof, 22ct)", w: 15.5, d: 27.3, f: 0.9167, p: 2, y: "1997 to today"},
  // ---- bars: sizes vary by maker, so match on weight ----
  ...[1, 2.5, 5, 10, 20, 31.1035, 50, 100].map(w => ({m: "au", g: "Gold bars (24ct)", n: `Gold bar ${w === 31.1035 ? "1oz" : w + "g"} (24ct, 99.99%)`, w, d: 0, f: 0.9999, p: 1, y: "any maker", bar: true})),
  ...[[31.1035, "1oz"], [311.035, "10oz"], [1000, "1kg"]].map(([w, n]) => ({m: "ag", g: "Silver bars", n: `Silver bar ${n} (99.9%)`, w, d: 0, f: 0.999, p: 1, y: "any maker", bar: true})),
  // ---- UK silver: same coin, different metal by date ----
  SV("Crown", 28.276, 38.61, "to 1919, 92.5% silver", 0.925, 2, "1818 to 1902", "crown"),
  SV("Crown", 28.276, 38.61, "1927–1937, 50% silver", 0.500, 2, "1927 to 1937", "crown"),
  SV("Crown", 28.276, 38.61, "1951–1981, no silver", 0, 0, "1951 to 1981", "crown"),
  SV("Double florin", 22.62, 36.00, "1887–1890, 92.5% silver", 0.925, 2, "1887 to 1890"),
  SV("Halfcrown", 14.138, 32.31, "to 1919, 92.5% silver", 0.925, 2, "1816 to 1919", "halfcrown"),
  SV("Halfcrown", 14.138, 32.31, "1920–1946, 50% silver", 0.500, 0, "1920 to 1946", "halfcrown"),
  SV("Halfcrown", 14.138, 32.31, "1947–1967, no silver", 0, 0, "1947 to 1967", "halfcrown"),
  SV("Florin (two shillings)", 11.31, 28.30, "to 1919, 92.5% silver", 0.925, 2, "1849 to 1919", "florin"),
  SV("Florin (two shillings)", 11.31, 28.30, "1920–1946, 50% silver", 0.500, 0, "1920 to 1946", "florin"),
  SV("Florin (two shillings)", 11.31, 28.30, "1947–1970, no silver", 0, 0, "1947 to 1970", "florin"),
  SV("Shilling", 5.655, 23.60, "to 1919, 92.5% silver", 0.925, 2, "1816 to 1919", "shilling"),
  SV("Shilling", 5.655, 23.60, "1920–1946, 50% silver", 0.500, 0, "1920 to 1946", "shilling"),
  SV("Shilling", 5.655, 23.60, "1947–1970, no silver", 0, 0, "1947 to 1970", "shilling"),
  SV("Sixpence", 2.83, 19.41, "to 1919, 92.5% silver", 0.925, 2, "1816 to 1919", "sixpence"),
  SV("Sixpence", 2.83, 19.41, "1920–1946, 50% silver", 0.500, 0, "1920 to 1946", "sixpence"),
  SV("Sixpence", 2.83, 19.41, "1947–1970, no silver", 0, 0, "1947 to 1970", "sixpence"),
  SV("Silver threepence", 1.41, 16.20, "to 1919, 92.5% silver", 0.925, 2, "1834 to 1919", "threep"),
  SV("Silver threepence", 1.41, 16.20, "1920–1945, 50% silver", 0.500, 2, "1920 to 1945", "threep"),
  {m: "ag", g: "UK silver (pre-1947)", n: "Maundy fourpence", w: 1.885, d: 17.60, f: 0.925, p: 3, y: "1822 to today"},
  {m: "ag", g: "UK silver (pre-1947)", n: "Maundy threepence", w: 1.414, d: 16.30, f: 0.925, p: 3, y: "1822 to today", fam: "threep"},
  {m: "ag", g: "UK silver (pre-1947)", n: "Maundy twopence", w: 0.943, d: 13.40, f: 0.925, p: 3, y: "1822 to today"},
  {m: "ag", g: "UK silver (pre-1947)", n: "Maundy penny", w: 0.471, d: 11.10, f: 0.925, p: 3, y: "1822 to today"},
  // ---- silver bullion and world silver ----
  {m: "ag", g: "Silver bullion & world silver", n: "Britannia silver 1oz (1997–2012, 95.8%)", w: 32.45, d: 40.00, f: 0.958, p: 1, y: "1997 to 2012"},
  {m: "ag", g: "Silver bullion & world silver", n: "Royal Mint silver 1oz (Britannia 2013 onwards, Lunar, Tudor Beasts, Myths & Legends)", w: 31.21, d: 38.61, f: 0.999, p: 1, y: "2013 to today"},
  {m: "ag", g: "Silver bullion & world silver", n: "Queen's Beasts silver 2oz", w: 62.42, d: 38.61, f: 0.9999, p: 1, y: "2016 to 2021"},
  {m: "ag", g: "Silver bullion & world silver", n: "Royal Mint £20 for £20 silver (2013 onwards)", w: 15.71, d: 27.00, f: 0.999, p: 0, y: "2013 to today"},
  {m: "ag", g: "Silver bullion & world silver", n: "Royal Mint £50 for £50 silver (2015 onwards)", w: 31.00, d: 34.00, f: 0.999, p: 0, y: "2015 to today"},
  {m: "ag", g: "Silver bullion & world silver", n: "Royal Mint £100 for £100 silver (2015 onwards)", w: 62.86, d: 40.00, f: 0.999, p: 0, y: "2015 to today"},
  {m: "ag", g: "Silver bullion & world silver", n: "Maple Leaf silver 1oz", w: 31.11, d: 38.00, f: 0.9999, p: 1, y: "1988 to today"},
  {m: "ag", g: "Silver bullion & world silver", n: "American Silver Eagle 1oz", w: 31.10, d: 40.60, f: 0.999, p: 1, y: "1986 to today"},
  {m: "ag", g: "Silver bullion & world silver", n: "Philharmonic silver 1oz", w: 31.10, d: 37.00, f: 0.999, p: 1, y: "2008 to today"},
  {m: "ag", g: "Silver bullion & world silver", n: "Krugerrand silver 1oz", w: 31.10, d: 38.725, f: 0.999, p: 1, y: "2017 to today"},
  {m: "ag", g: "Silver bullion & world silver", n: "Kookaburra silver 1oz", w: 31.10, d: 40.60, f: 0.999, p: 1, y: "1990 to today"},
  {m: "ag", g: "Silver bullion & world silver", n: "Mexican Libertad silver 1oz", w: 31.10, d: 40.00, f: 0.999, p: 1, y: "1982 to today"},
  {m: "ag", g: "Silver bullion & world silver", n: "Maria Theresa thaler (1780 restrike)", w: 28.0668, d: 39.50, f: 0.8333, p: 0, y: "dated 1780, struck since"},
  {m: "ag", g: "Silver bullion & world silver", n: "5 Francs silver (French, Swiss, Belgian, Italian 5 Lire)", w: 25.0, d: 37.00, f: 0.900, p: 0, y: "1800s to 1930s"},
  {m: "ag", g: "Silver bullion & world silver", n: "Indian rupee (to 1940, 91.7% silver)", w: 11.66, d: 30.50, f: 0.917, p: 0, y: "to 1940", fam: "rupee"},
  {m: "ag", g: "Silver bullion & world silver", n: "Indian rupee (1940–1945, 50% silver)", w: 11.66, d: 30.50, f: 0.500, p: 0, y: "1940 to 1945", fam: "rupee"},
  {m: "ag", g: "Silver bullion & world silver", n: "Indian half rupee (to 1940, 91.7% silver)", w: 5.83, d: 24.30, f: 0.917, p: 0, y: "to 1940", fam: "halfrupee"},
  {m: "ag", g: "Silver bullion & world silver", n: "Indian half rupee (1940–1945, 50% silver)", w: 5.83, d: 24.30, f: 0.500, p: 0, y: "1940 to 1945", fam: "halfrupee"},
  {m: "ag", g: "Silver bullion & world silver", n: "US Morgan / Peace dollar", w: 26.73, d: 38.10, f: 0.900, p: 2, y: "1878 to 1935"},
  {m: "ag", g: "Silver bullion & world silver", n: "US half dollar (pre-1965)", w: 12.50, d: 30.60, f: 0.900, p: 1, y: "to 1964"},
  {m: "ag", g: "Silver bullion & world silver", n: "US quarter (pre-1965)", w: 6.25, d: 24.26, f: 0.900, p: 0, y: "to 1964"},
];
// Sets: boxed proof sets usually sell for well over melt, so the advice is to keep them together.
const COIN_SETS = [
  {n: "Sovereign 3-coin set (full, half, quarter)", parts: ["Sovereign (full)", "Half sovereign", "Quarter sovereign"]},
  {n: "Sovereign 3-coin set (double, full, half)", parts: ["Double sovereign (£2)", "Sovereign (full)", "Half sovereign"]},
  {n: "Sovereign 4-coin set (double, full, half, quarter)", parts: ["Double sovereign (£2)", "Sovereign (full)", "Half sovereign", "Quarter sovereign"]},
  {n: "Sovereign 5-coin set (£5, double, full, half, quarter)", parts: ["Five sovereign piece (£5)", "Double sovereign (£2)", "Sovereign (full)", "Half sovereign", "Quarter sovereign"]},
  {n: "Britannia 4-coin set (22ct, 1987–2012)", parts: ["Britannia 1oz (22ct, 1987–2012)", "Britannia 1/2oz (22ct, 1987–2012)", "Britannia 1/4oz (22ct, 1987–2012)", "Britannia 1/10oz (22ct, 1987–2012)"]},
  {n: "Krugerrand 4-coin set", parts: ["Krugerrand 1oz", "Krugerrand 1/2oz", "Krugerrand 1/4oz", "Krugerrand 1/10oz"]},
  {n: "Maundy set (4d, 3d, 2d, 1d)", parts: ["Maundy fourpence", "Maundy threepence", "Maundy twopence", "Maundy penny"]},
].map(st => Object.assign({set: true, g: "Sets", p: 3}, st, {items: st.parts.map(n => COINS.find(c => c.n === n))}));
const COIN_ALL = COINS.concat(COIN_SETS);
const METAL_FAMS = ["crown5", "two", "one", "fifty"];   // base-metal and silver proof versions weigh the same
const PREM = {
  0: ["Melt value only", "Coins like this trade on their metal."],
  1: ["A little over melt", "Bullion. Bullion dealers usually pay a little over melt for good, unscratched ones (bars still sealed in their card), so selling to one can beat scrapping."],
  2: ["Check the date: could be worth more", "Common dates go for about melt, but older, rarer dates, mint marks and coins in very good condition can be worth much more. Look the date up in a catalogue such as Spink's Coins of England before melting it."],
  3: ["Usually worth more than melt: don't scrap", "Collectors pay more than the metal is worth. Get it valued by a coin dealer or auction house before doing anything else."]
};
let agGbpPerGram = null;
async function loadSilver(){
  try {
    const [xag, fx] = await Promise.all([fetchJSON("https://api.gold-api.com/price/XAG").then(d => d.price),
      fetchJSON("https://open.er-api.com/v6/latest/GBP").then(d => d.rates.USD).catch(() => fetchJSON("https://api.frankfurter.app/latest?from=GBP&to=USD").then(d => d.rates.USD))]);
    if (xag > 0 && fx > 0){ agGbpPerGram = xag / fx / OZ; store.set("agG", String(agGbpPerGram)); }
  } catch(e){ const c = parseFloat(store.get("agG")); if (c > 0) agGbpPerGram = c; }
  try { renderCoins(); } catch(e){}
}
function coinMargin(){ return Math.min(90, Math.max(0, parseFloat(store.get("pmM") || "20") || 0)) / 100; }
function coinVal(c, wt){   // {melt, pays} for one coin; pays = what a refiner pays (gold only)
  wt = wt || c.w;
  if (c.m === "au"){
    if (!gbpPerGram) return null;
    const pays = c.f > 0.91 && c.f < 0.92 ? refinerG("0.916") : c.f >= 0.999 ? refinerG("0.999") : gbpPerGram * c.f * payRatio();
    return {melt: wt * c.f * gbpPerGram, pays: wt * pays};
  }
  if (c.m === "ag") return agGbpPerGram ? {melt: wt * c.f * agGbpPerGram, pays: null} : null;
  return {melt: 0, pays: null};
}
const metalWord = c => c.m === "au" ? "gold" : c.m === "ag" ? "silver" : "silver";
function purity(c){
  if (c.m === "cn") return "None (cupronickel)";
  const pc = (c.f * 100).toFixed(2).replace(/\.?0+$/, "") + "%";
  if (c.m === "au") return (c.f > 0.91 && c.f < 0.92 ? "22ct" : c.f >= 0.999 ? "24ct" : c.f >= 0.98 ? "23.6ct" : "21.6ct") + " gold (" + pc + ")";
  return pc + " silver";
}
function premHTML(p){ return `<div class="warn" style="margin-top:8px;${p >= 2 ? "" : "border-color:var(--line);background:none"}"><strong>${PREM[p][0]}.</strong> ${PREM[p][1]}</div>`; }
function coinHTML(c, weight, qty){
  const n = qty || 1, m = coinMargin();
  if (c.set){
    const au = c.items.filter(x => x.m === "au"), ag = c.items.filter(x => x.m === "ag");
    const vals = c.items.map(x => coinVal(x)), have = vals.every(v => v);
    const melt = have ? vals.reduce((t, v) => t + v.melt, 0) : 0;
    const pays = have && au.length === c.items.length ? vals.reduce((t, v) => t + v.pays, 0) : null;
    return `<div class="result"><div class="muted">Set of ${c.items.length}</div><b style="font-size:19px">${esc(c.n)}</b>
      <table style="margin-top:8px">
        ${c.items.map(x => `<tr><td>${esc(x.n)}</td><td>${(x.w * x.f).toFixed(3)} g ${metalWord(x)}</td></tr>`).join("")}
        <tr><td><strong>Total pure ${au.length ? "gold" : "silver"}</strong></td><td><strong>${c.items.reduce((t, x) => t + x.w * x.f, 0).toFixed(3)} g</strong></td></tr>
        ${have ? `<tr><td>Melt value${n > 1 ? ` × ${n}` : ""}</td><td>${fmt(melt * n, 0)}</td></tr>` : ""}
        ${pays ? `<tr><td>Refiner pays${n > 1 ? ` × ${n}` : ""}</td><td>${fmt(pays * n, 0)}</td></tr>` : ""}
      </table>
      ${premHTML(3)}
      <p class="muted" style="margin:6px 0 0">A complete set in its original box with the certificate is worth the most, so keep the coins, box and paperwork together. Proof sets from the Royal Mint usually resell well above melt to coin dealers.</p></div>`;
  }
  const wt = weight || c.w, v = coinVal(c, wt), pure = wt * c.f;
  return `<div class="result">
    <div class="muted">${esc(c.g)} · ${esc(c.y)}</div><b style="font-size:19px">${esc(c.n)}</b>
    <table style="margin-top:8px">
      <tr><td>Weight</td><td>${+c.w.toFixed(3)} g${weight ? ` (yours ${weight.toFixed(2)} g)` : ""}</td></tr>
      <tr><td>${c.bar ? "Size" : "Diameter"}</td><td>${c.bar ? "varies by maker" : c.d.toFixed(2) + " mm"}</td></tr>
      <tr><td>Metal</td><td>${purity(c)}</td></tr>
      ${c.m !== "cn" ? `<tr><td>Pure ${metalWord(c)} in it</td><td><strong>${pure.toFixed(3)} g</strong> (${(pure / OZ).toFixed(4)} oz)</td></tr>` : ""}
      ${v && c.m !== "cn" ? `<tr><td>Melt value${n > 1 ? ` × ${n}` : ""}</td><td>${fmt(v.melt * n, v.melt < 20 ? 2 : 0)}</td></tr>
      ${v.pays ? `<tr><td>Refiner pays${n > 1 ? ` × ${n}` : ""}</td><td>${fmt(v.pays * n, 0)}</td></tr>` : ""}
      <tr><td>Pay up to${n > 1 ? ` × ${n}` : ""}</td><td><strong>${fmt((v.pays || v.melt) * (1 - m) * n, v.melt < 20 ? 2 : 0)}</strong></td></tr>` : ""}
      ${c.m === "ag" && !v ? `<tr><td colspan="2" class="muted">Waiting for the live silver price…</td></tr>` : ""}
    </table>
    ${v && c.m !== "cn" ? `<p class="muted" style="margin:6px 0 0">Pay up to keeps your ${Math.round(m * 100)}% margin on ${v.pays ? "the refiner price" : "the silver melt value"}.</p>` : ""}
    ${c.m === "cn" ? `<p class="muted" style="margin:6px 0 0">No precious metal, so it's only worth face value unless it's rare or in a special proof box. Silver proof versions of modern £5 crowns exist: they come boxed with a certificate.</p>` : premHTML(c.p)}
    ${c.p >= 1 && c.m !== "cn" && /Britannia|Sovereign|Guinea|Maundy/i.test(c.n) && c.m === "au" ? `<p class="muted" style="margin:6px 0 0">UK sovereigns and Britannias are legal tender, so they're free of capital gains tax for private buyers, which keeps demand for them strong.</p>` : ""}
    ${typeof coinBuy === "function" && c.m !== "cn" && v ? `<button class="btn" onclick='coinBuy([${JSON.stringify({n: c.n, qty: n, w: wt}).replace(/'/g, "&#39;")}])'>Buy ${n > 1 ? "these" : "it"} from the customer</button>` : ""}
  </div>`;
}
function renderCoins(){
  if (!$("coinSel").options.length){
    let html = "", grp = "";
    COIN_ALL.forEach((c, i) => { if (c.g !== grp){ if (grp) html += "</optgroup>"; grp = c.g; html += `<optgroup label="${esc(grp)}">`; } html += `<option value="${i}">${esc(c.n)}</option>`; });
    $("coinSel").innerHTML = html + "</optgroup>";
    const saved = store.get("coinSel"); $("coinSel").value = saved && COIN_ALL[+saved] ? saved : "0";
  }
  const mode = document.querySelector("#coinTabs .on").dataset.c;
  if (mode === "scan"){ renderScan(); return; }
  if (mode === "look"){ $("coinOut").innerHTML = coinHTML(COIN_ALL[+$("coinSel").value], null, Math.max(1, parseInt($("coinQty").value) || 1)); return; }
  const w = parseFloat($("coinW").value), d = parseFloat($("coinD").value), metal = $("coinM").value;
  if (!(w > 0)){ $("coinOut").innerHTML = '<p class="muted" style="margin:10px 0 0">Enter the weight to see what it is.</p>'; return; }
  // coins lose weight with wear but never gain it, so being heavy counts against a match more than being light
  const pool = COINS.filter(c => metal === "any" || (metal === "au" ? c.m === "au" : c.m !== "au"));
  const seen = new Set();
  const ranked = pool.map(c => {
    const dw = (w - c.w) / c.w * 100, dd = d > 0 && !c.bar ? d - c.d : null;
    // UK coins are far more common over a UK counter, so they win a near tie
    return {c, dw, dd, score: ((dw > 0 ? dw * 3 : -dw * 0.7) + (dd == null ? 0 : Math.abs(dd) / c.d * 100 * 2)) * (c.g.startsWith("UK") ? 0.6 : 1)};
  }).sort((a, b) => a.score - b.score).filter(r => { const k = r.c.fam || r.c.n; if (seen.has(k)) return false; seen.add(k); return true; });
  const best = ranked[0];
  if (!best || Math.abs(best.dw) > 6 || (best.dd != null && Math.abs(best.dd) > 1)){
    $("coinOut").innerHTML = `<div class="warn"><b>No match.</b> Nothing in the list is ${w.toFixed(2)} g${d > 0 ? ` and ${d.toFixed(2)} mm` : ""}. It may be a coin that isn't listed, a medal, or a fake.${best ? ` Closest is the ${esc(best.c.n)} (${best.c.w.toFixed(2)} g${best.c.bar ? "" : `, ${best.c.d.toFixed(2)} mm`}).` : ""}</div>`;
    return;
  }
  const notes = [];
  if (best.dw > 0.6) notes.push(`It's ${best.dw.toFixed(1)}% <b>heavier</b> than a real one should be. Genuine coins don't gain weight, so check your scales and treat it as a possible fake.`);
  else if (best.dw < -2) notes.push(`It's ${Math.abs(best.dw).toFixed(1)}% <b>light</b>. Heavy wear can take off a little, but this much is a warning sign for a fake or a clipped coin.`);
  else if (best.dw < -0.6) notes.push(`It's ${Math.abs(best.dw).toFixed(1)}% light, which is normal for a worn coin. Value it on its actual weight.`);
  if (best.dd != null && Math.abs(best.dd) > 0.25) notes.push(`The diameter is ${Math.abs(best.dd).toFixed(2)} mm ${best.dd > 0 ? "too wide" : "too small"}. Right weight but wrong size is a classic sign of a fake.`);
  if (best.dd == null) notes.push("Measure the diameter too. Weight alone can't tell coins of similar weight apart, and it's the best check against fakes.");
  const close = ranked.slice(1, 4).filter(r => (best.dd == null ? Math.abs(r.dw) < 2.5 : Math.abs(r.dw) < 1.5 && Math.abs(r.dd) < 0.3));
  const mixed = metal === "any" && close.some(r => (r.c.m === "au") !== (best.c.m === "au"));
  if (mixed) notes.unshift(`<b>Gold and silver versions of this size exist.</b> Pick its colour above before you price it, as the gold one is worth many times more.`);
  const ok = !mixed && Math.abs(best.dw) <= 0.6 && (best.dd == null || Math.abs(best.dd) <= 0.25);
  const fam = best.c.fam ? COIN_ALL.filter(c => c.fam === best.c.fam) : null;
  const famName = fam ? best.c.n.replace(/ \(.*\)$/, "") : best.c.n;
  $("coinOut").innerHTML = `<div class="verdict ${ok ? "t1" : "t2"}" style="margin:12px 0 0"><div class="call" style="font-size:18px">${ok ? "Matches" : "Check this one"}: ${esc(famName)}</div>
      ${notes.length ? `<div>${notes.join(" ")}</div>` : `<div>Weight${best.dd != null ? " and size match" : " matches"} the official spec.</div>`}</div>
    ${close.length ? `<p class="muted" style="margin:8px 0 0">Could also be: ${close.map(r => esc(r.c.fam ? r.c.n.replace(/ \(.*\)$/, "") : r.c.n)).join(", ")}. Check the design and wording on it.</p>` : ""}
    ${fam ? `<div class="warn">${METAL_FAMS.includes(best.c.fam) ? `<b>Check the metal.</b> The standard and silver proof versions weigh exactly the same. The silver one comes boxed with a Royal Mint certificate, and has a mirror background with a frosted design. If there's no certificate, have it tested before you pay silver money.` : `<b>Look at the date.</b> These weigh the same whatever they're made of, so the date decides how much silver is in it.`}
        <table style="margin-top:6px">${fam.map(c => { const v = coinVal(c, w); return `<tr><td>${esc(c.n.replace(/^.*\((.*)\)$/, "$1"))}${/Maundy/.test(c.n) ? " (Maundy)" : ""}</td><td>${c.m === "cn" ? "face value" : v ? fmt(v.melt, 2) + " melt" : ""}</td></tr>`; }).join("")}</table></div>
        ${fam.filter(c => c.m !== "cn").slice(0, 1).map(c => coinHTML(c, w, 1)).join("")}`
      : coinHTML(best.c, w, 1)}
    <p class="muted" style="margin:8px 0 0">Quick extra checks: gold and silver aren't magnetic, so a coin that sticks to a strong magnet is fake. Real gold and silver coins also ring for a long time when balanced on a fingertip and tapped.</p>`;
}
document.querySelectorAll("#coinTabs button").forEach(b => b.onclick = () => {
  document.querySelectorAll("#coinTabs button").forEach(x => x.classList.toggle("on", x === b));
  $("coinLook").style.display = b.dataset.c === "look" ? "" : "none"; $("coinId").style.display = b.dataset.c === "id" ? "" : "none";
  $("coinScan").style.display = b.dataset.c === "scan" ? "" : "none"; renderCoins();
});
$("coinSel").addEventListener("change", () => { store.set("coinSel", $("coinSel").value); renderCoins(); });
["coinQty", "coinW", "coinD"].forEach(id => $(id).addEventListener("input", renderCoins));
$("coinM").addEventListener("change", renderCoins);
loadSilver(); setInterval(loadSilver, 15 * 60000);

/* ---- scan with camera: an AI reads the photos, the app does the sums from the official coin specs ---- */
const SCAN_URL = "https://gold-coin-scan.maximus6569.workers.dev/";   // the Gold Trader coin scanner (Cloudflare Worker), see scan-worker/
let scPhotos = [], scResult = null, scBusy = false, scErr = "", scOpen = -1;
function shrinkPhoto(file){
  return new Promise((ok, bad) => {
    const img = new Image(), url = URL.createObjectURL(file);
    img.onload = () => { const k = Math.min(1, 1600 / Math.max(img.width, img.height)), c = document.createElement("canvas");
      c.width = Math.round(img.width * k); c.height = Math.round(img.height * k); c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url); ok(c.toDataURL("image/jpeg", 0.85)); };
    img.onerror = () => { URL.revokeObjectURL(url); bad(new Error("photo")); };
    img.src = url;
  });
}
$("scTake").onclick = () => $("scFile").click();
async function scAdd(input){
  const files = [...input.files]; input.value = ""; if (!files.length) return;
  for (const f of files){
    try { scPhotos.push(await shrinkPhoto(f)); scResult = null; scErr = ""; } catch(e){ scErr = "Couldn't open one of those photos. Try another."; }
  }
  if (scPhotos.length > 4){ scPhotos = scPhotos.slice(-4); scErr = scErr || ""; }
  renderScan();
}
$("scFile").addEventListener("change", () => scAdd($("scFile")));
$("scPick").addEventListener("change", () => scAdd($("scPick")));
$("scUp").onclick = () => $("scPick").click();
$("scClear").onclick = () => { scPhotos = []; scResult = null; scErr = ""; renderScan(); };
$("scGo").onclick = async () => {
  if (scBusy || !scPhotos.length) return;
  if (!navigator.onLine){ scErr = "Scanning needs a signal. Your photos are kept here: tap Scan again once you're back online."; renderScan(); return; }
  if (!SCAN_URL){ scErr = "The camera scan isn't switched on yet. It needs its AI service set up first."; renderScan(); return; }
  scBusy = true; scErr = ""; scResult = null; scOpen = -1; renderScan();
  try {
    const r = await fetch(SCAN_URL, {method: "POST", headers: {"Content-Type": "application/json"},
      body: JSON.stringify({photos: scPhotos.map(d => d.split(",")[1]), catalogue: COIN_ALL.map(c => c.n)})});
    const j = await r.json().catch(() => ({}));
    if (!r.ok || !j.result) throw new Error(j.error || "The scan didn't work. Check your signal and try again.");
    scResult = j.result;
  } catch(e){ scErr = e.message || "The scan didn't work. Check your signal and try again."; }
  scBusy = false; renderScan();
};
function renderScan(){
  $("scThumbs").innerHTML = scPhotos.map((d, i) => `<div style="position:relative"><img src="${d}" style="width:72px;height:72px;object-fit:cover;border-radius:10px;border:1px solid var(--line)">
    <button onclick="scPhotos.splice(${i},1);scResult=null;renderScan()" style="position:absolute;top:-6px;right:-6px;width:22px;height:22px;border-radius:50%;border:0;background:#000;color:#fff;font-size:13px">×</button></div>`).join("");
  $("scTake").textContent = scPhotos.length ? (scPhotos.length < 4 ? "📷 Take another" : "📷 Replace the last") : "📷 Take a photo";
  $("scUp").textContent = scPhotos.length ? "🖼 Upload more" : "🖼 Upload photos";
  $("scGo").style.display = scPhotos.length ? "" : "none";
  $("scGo").textContent = scBusy ? "Scanning…" : scResult ? "Scan again" : "Scan these photos";
  $("scClear").style.display = scPhotos.length ? "" : "none";
  if (scErr){ $("coinOut").innerHTML = `<div class="warn">${esc(scErr)}</div>`; return; }
  if (!scResult){ $("coinOut").innerHTML = scBusy ? '<p class="muted" style="margin:10px 0 0">Reading the coins, this takes a few seconds…</p>' : ""; return; }
  $("coinOut").innerHTML = scanHTML(scResult);
  const w = $("scW"); if (w) w.oninput = () => { store.set("scW", w.value); scanCheck(); };
  scanCheck();
}
let scExpected = 0;
function scanHTML(res){
  const m = coinMargin(), rows = [], unpriced = [];
  let crown5 = false, pureAu = 0, pureAg = 0, melt = 0, pays = 0, allPaid = true, prem = 0, wt = 0;
  if (!res.photo_ok) return `<div class="warn"><b>Couldn't read the coins.</b> ${esc(res.photo_tip || "Take the photo closer, in good light, with the coins flat.")}</div>`;
  (res.coins || []).forEach(x => {
    const n = Math.max(1, parseInt(x.count) || 1), c = COIN_ALL.find(c2 => c2.n === x.catalogue);
    const items = !c ? [] : c.set ? c.items.filter(Boolean) : [c];
    if (!items.length){ unpriced.push(`${n > 1 ? n + " × " : ""}${esc(x.name || "Unknown coin")}${x.note ? ` <span class="muted">(${esc(x.note)})</span>` : ""}`); return; }
    if (METAL_FAMS.includes(c.fam)) crown5 = true;
    let rMelt = 0, rPays = 0, rPure = 0, ok = true;
    items.forEach(it => { const v = coinVal(it); if (!v){ ok = false; return; } rMelt += v.melt; if (v.pays) rPays += v.pays; else if (it.m === "au") ok = false;
      if (it.m === "au") pureAu += it.w * it.f * n; else if (it.m === "ag") pureAg += it.w * it.f * n; rPure += it.w * it.f; wt += it.w * n; if (it.m !== "au") allPaid = false; });
    melt += rMelt * n; pays += rPays * n; prem = Math.max(prem, x.proof ? 3 : (c.p || 0));
    const ci = COIN_ALL.indexOf(c), open = scOpen === ci;
    rows.push(`<tr onclick="scOpen=scOpen===${ci}?-1:${ci};renderScan()" style="cursor:pointer"><td>${n > 1 ? `<b>${n} ×</b> ` : ""}${esc(x.name || c.n)} <span style="color:var(--gold);font-size:13px">${open ? "▲ hide details" : "▼ details"}</span><div class="muted">${esc(c.n)}${x.proof ? " · proof" : ""}${x.confidence && x.confidence !== "high" ? ` · <span class="neg">${x.confidence} confidence, check it</span>` : ""}${x.note ? " · " + esc(x.note) : ""}</div></td>
      <td>${(rPure * n).toFixed(2)} g<div class="muted">${ok ? fmt(rMelt * n, 0) : "…"}</div></td></tr>
      ${open ? `<tr><td colspan="2" style="padding:0 0 8px">${coinHTML(c, null, n)}</td></tr>` : ""}`);
  });
  scExpected = wt;
  if (!rows.length && !unpriced.length) return `<div class="warn"><b>No coins found.</b> Try again with the coins flat, close up and in good light.</div>`;
  const set = res.set;
  return `<div class="result">
    ${set ? `<div class="muted">Set${set.complete === false ? " (not complete)" : set.complete ? " (complete)" : ""}</div><b style="font-size:19px">${esc(set.name || "Coin set")}</b>${set.certificate ? `<div class="muted">Certificate: ${esc(set.certificate)}</div>` : ""}` : `<b style="font-size:19px">${rows.length + unpriced.length === 1 ? "Found 1 coin type" : `Found ${rows.length + unpriced.length} coin types`}</b>`}
    ${rows.length ? `<table style="margin-top:8px"><tr><td class="muted">Coin</td><td class="muted">Pure metal · melt</td></tr>${rows.join("")}
      ${pureAu ? `<tr><td><strong>Total pure gold</strong></td><td><strong>${pureAu.toFixed(3)} g</strong></td></tr>` : ""}
      ${pureAg ? `<tr><td><strong>Total pure silver</strong></td><td><strong>${pureAg.toFixed(2)} g</strong></td></tr>` : ""}
      ${!pureAu && !pureAg ? `<tr><td colspan="2"><b>No gold or silver in ${rows.length > 1 ? "these" : "this"}.</b> Worth face value only, unless a collector wants it.</td></tr>` : `<tr><td>Melt value</td><td>${fmt(melt, 0)}</td></tr>`}
      ${allPaid && pays ? `<tr><td>${mmOn() ? "Mastermelt pays" : "Refiner pays"}</td><td>${fmt(pays, 0)}</td></tr>` : ""}
      ${pureAu || pureAg ? `<tr><td>Pay up to</td><td><strong>${fmt((allPaid && pays ? pays : melt) * (1 - m), 0)}</strong></td></tr>` : ""}</table>
      <p class="muted" style="margin:6px 0 0">From the official weights of each coin, at today's price. Pay up to keeps your ${Math.round(m * 100)}% margin.</p>` : ""}
    ${unpriced.length ? `<div class="warn"><b>Not priced:</b> ${unpriced.join(", ")}. These aren't in the coin list, so weigh them and use Identify a coin, or price them on the offer screen.</div>` : ""}
    ${crown5 ? `<div class="warn"><b>Check the metal.</b> Most modern crowns, £2, £1 and 50p coins are base metal, worth face value only. The silver proof weighs exactly the same, so the scales can't tell them apart. The silver one comes boxed with a Royal Mint certificate. If there's no certificate, have it tested before you pay silver money.</div>` : ""}
    ${(() => {   // the app already says "weigh it" and "don't scrap", and gives the official weight: keep only the AI's extra warnings
      const w = (res.warnings || []).flatMap(x => String(x).split(/(?<=[.!?;])\s+/)).map(x => x.trim()).filter(x => x.length > 3).filter(x => !/\b\d+(\.\d+)?\s*g\b|grams?\b|weigh|authentic|genuine|photograph/i.test(x) && !(prem >= 2 && /scrap|valued|collect/i.test(x)));
      return w.length ? `<div class="warn"><b>Watch out:</b> ${w.map(esc).join(" ")}</div>` : "";
    })()}
    ${rows.length ? `<div class="sub" style="margin-top:14px">Check it's real: weigh it</div>
      <label>Weight of ${unpriced.length ? "the priced coins" : "all the coins"} together, grams${set ? " (out of the case, or weigh the case on its own and take it off)" : ""}</label>
      <input id="scW" type="number" inputmode="decimal" step="0.01" placeholder="should be about ${wt.toFixed(2)}" value="${esc(store.get("scW") || "")}">
      <div id="scWOut"></div>` : ""}
    ${prem >= 2 ? premHTML(prem) : ""}
    <p class="muted" style="margin:8px 0 0">The AI reads the coins from the photo. It can't tell real gold from a good fake, so always weigh before you buy. Check anything marked low confidence by hand.</p>
    ${typeof coinBuy === "function" && (pureAu || pureAg) ? `<button class="btn" onclick="coinBuy(scBuyLines())">Buy these from the customer</button>` : ""}
  </div>`;
}
/* the scanned coins as lines for the Buy log: one per coin type (sets split into their coins), at the official weights */
function scBuyLines(){ const out = []; ((scResult || {}).coins || []).forEach(x => { const n = Math.max(1, parseInt(x.count) || 1), c = COIN_ALL.find(c2 => c2.n === x.catalogue); if (!c) return;
  (c.set ? c.items.filter(Boolean) : [c]).forEach(it => { if (it.m !== "cn") out.push({n: it.n, qty: n, w: it.w}); }); }); return out; }
function scanCheck(){
  const out = $("scWOut"), w = parseFloat(($("scW") || {}).value); if (!out) return;
  if (!(w > 0) || !scExpected){ out.innerHTML = ""; return; }
  const d = (w - scExpected) / scExpected * 100;
  out.innerHTML = d > 0.6 ? `<div class="warn">It's ${d.toFixed(1)}% <b>heavier</b> than these coins should be (${scExpected.toFixed(2)} g). Genuine coins don't gain weight. Check the count, your scales, or for something extra on the scales.</div>`
    : d < -2 ? `<div class="warn">It's ${Math.abs(d).toFixed(1)}% <b>light</b> (should be ${scExpected.toFixed(2)} g). That's more than wear explains: check for a missing coin or a fake.</div>`
    : `<div class="verdict t1" style="margin:8px 0 0"><div class="call" style="font-size:17px">Weight matches</div><div>${w.toFixed(2)} g against ${scExpected.toFixed(2)} g expected${d < -0.6 ? ", a little light, which is normal for worn coins" : ""}.</div></div>`;
}

