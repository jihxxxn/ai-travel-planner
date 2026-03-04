import { useState, useEffect } from "react";

const CURRENCY_SYMBOLS = { CNY: "¥", AUD: "A$", JPY: "¥", USD: "$", EUR: "€", HKD: "HK$", THB: "฿", SGD: "S$" };
const CITY_CURRENCY = {
  "상하이": "CNY", "베이징": "CNY", "청두": "CNY", "시안": "CNY",
  "도쿄": "JPY", "오사카": "JPY", "삿포로": "JPY",
  "시드니": "AUD", "멜버른": "AUD",
  "뉴욕": "USD", "LA": "USD", "샌프란시스코": "USD",
  "파리": "EUR", "로마": "EUR", "바르셀로나": "EUR",
  "홍콩": "HKD", "방콕": "THB", "싱가포르": "SGD"
};

function getCategoryColor(cat) {
  if (!cat) return "#555";
  if (cat.includes("식사") || cat.includes("밥") || cat.includes("식당")) return "#E8472A";
  if (cat.includes("카페")) return "#C9853A";
  if (cat.includes("관광") || cat.includes("문화") || cat.includes("역사")) return "#3A7EC9";
  if (cat.includes("교통")) return "#5A3AC9";
  if (cat.includes("쇼핑")) return "#3AC97E";
  return "#888";
}

function formatDate(dateStr) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  return `${d.getMonth()+1}월 ${d.getDate()}일`;
}

export default function TravelPlanner() {
  const [city, setCity] = useState("상하이");
  const [arrivalDate, setArrivalDate] = useState("");
  
  const [departureDate, setDepartureDate] = useState("");
  const [styleList, setStyleList] = useState([]);
  const [budget, setBudget] = useState("");
  const [itinerary, setItinerary] = useState(null);
  const [loading, setLoading] = useState(false);
  const [activeDay, setActiveDay] = useState(0);
  const [currency, setCurrency] = useState("CNY");
  const [exchangeRate, setExchangeRate] = useState(null);
  const [rateLoading, setRateLoading] = useState(false);
  const [error, setError] = useState("");

  const styleOptions = [
    "인스타 감성 📸", "걷기 최소화 🚗",
    "로컬 맛집 위주 🍜", "카페 투어 ☕",
    "쇼핑 위주 🛍️", "역사/문화 탐방 🏛️"
  ];

  const [arrivalHour, setArrivalHour] = useState("12");
  const [arrivalMin, setArrivalMin] = useState("00");
  const [departureHour, setDepartureHour] = useState("12");
  const [departureMin, setDepartureMin] = useState("00");

  const arrivalTime = `${arrivalHour.padStart(2,"0")}:${arrivalMin.padStart(2,"0")}`;
  const departureTime = `${departureHour.padStart(2,"0")}:${departureMin.padStart(2,"0")}`;

  const toggleStyle = (s) =>
    setStyleList(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]);

  // Fetch real exchange rate when city changes
  useEffect(() => {
    const detectedCurrency = CITY_CURRENCY[city] || "USD";
    setCurrency(detectedCurrency);
    if (detectedCurrency) fetchExchangeRate(detectedCurrency);
  }, [city]);

  const fetchExchangeRate = async (targetCurrency) => {
    setRateLoading(true);
    setExchangeRate(null);
    try {
      const res = await fetch(`https://api.frankfurter.app/latest?from=KRW&to=${targetCurrency}`);
      const data = await res.json();
      const rate = data.rates?.[targetCurrency];
      if (rate) setExchangeRate(rate);
    } catch {
      // fallback rates
      const fallback = { CNY: 0.0053, AUD: 0.0011, JPY: 0.11, USD: 0.00072, EUR: 0.00067, HKD: 0.0056, THB: 0.026, SGD: 0.00097 };
      setExchangeRate(fallback[targetCurrency] || 0.00072);
    }
    setRateLoading(false);
  };

  // KRW -> foreign
  const krwToForeign = (krw) => exchangeRate ? (krw * exchangeRate) : 0;
  // foreign -> KRW
  const foreignToKrw = (foreign) => exchangeRate ? Math.round(foreign / exchangeRate) : 0;

  const totalKRW = itinerary
    ? itinerary.days.flatMap(d => d.places).reduce((sum, p) => sum + (p.costKRW || 0), 0)
    : 0;

  const categoryTotals = itinerary
    ? itinerary.days.flatMap(d => d.places).reduce((acc, p) => {
        const key = p.category || "기타";
        acc[key] = (acc[key] || 0) + (p.costKRW || 0);
        return acc;
      }, {})
    : {};

  // Calculate trip days from arrival/departure
  const getTripDays = () => {
    if (!arrivalDate || !departureDate) return null;
    const arr = new Date(arrivalDate);
    const dep = new Date(departureDate);
    const diff = Math.round((dep - arr) / (1000 * 60 * 60 * 24));
    return diff > 0 ? diff + 1 : null;
  };

  const tripDays = getTripDays();

  const generate = async () => {
    if (!city.trim() || !arrivalDate || !departureDate) {
      setError("도시, 도착 날짜/시간, 출발 날짜/시간을 모두 입력해주세요.");
      return;
    }
    if (!tripDays) {
      setError("출발일이 도착일보다 빨라요. 날짜를 확인해주세요.");
      return;
    }
    setLoading(true);
    setError("");
    setItinerary(null);

    const detectedCurrency = CITY_CURRENCY[city] || "USD";
    const rate = exchangeRate ? (1 / exchangeRate) : 1380;
    const styleStr = styleList.length > 0 ? styleList.join(", ") : "general sightseeing";
    const budgetStr = budget ? budget + " manwon (KRW)" : "no limit";

    // Build day info for prompt
    const days = [];
    const arrDate = new Date(arrivalDate);
    for (let i = 0; i < tripDays; i++) {
      const d = new Date(arrDate);
      d.setDate(d.getDate() + i);
      const isFirst = i === 0;
      const isLast = i === tripDays - 1;
      const label = `${d.getMonth()+1}/${d.getDate()}`;
      let note = "";
      if (isFirst && isLast) note = `arrival at ${arrivalTime}, departure at ${departureTime} same day`;
      else if (isFirst) note = `arrival at ${arrivalTime}, plan from arrival time`;
      else if (isLast) note = `departure at ${departureTime}, must finish before departure, include airport transfer`;
      else note = "full day";
      days.push({ day: i+1, date: label, note });
    }

    const daysInfo = days.map(d => `Day ${d.day} (${d.date}): ${d.note}`).join("\n");

    const prompt = `You are a travel planner. Return ONLY valid JSON, no markdown, no explanation.

City: ${city}
Style: ${styleStr}
Budget: ${budgetStr}
Currency: ${detectedCurrency}

Flight info:
- Arrival: ${arrivalDate} ${arrivalTime}
- Departure: ${departureDate} ${departureTime}

Day schedule:
${daysInfo}

Return exactly this JSON:
{"title":"Korean title","summary":"Korean summary","days":[{"day":1,"date":"M/D","theme":"Korean theme","note":"arrival/departure note in Korean","places":[{"time":"09:00","name":"place name","description":"Korean desc max 20 chars","category":"one of: 식사, 카페, 관광, 교통, 쇼핑","cost":50,"tip":"Korean tip max 20 chars"}]}]}

Rules:
- First day: schedule AFTER arrival time ${arrivalTime}
- Last day: schedule BEFORE departure time ${departureTime}, always include airport transfer as last item
- Other days: 4 places per day
- First/last day: 2-3 places depending on available time
- cost is ${detectedCurrency} integer
- All text in Korean`;

    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-6-20251101",
          max_tokens: 8000,
          messages: [{ role: "user", content: prompt }]
        })
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(`API 오류 ${res.status}: ${errData?.error?.message || res.statusText}`);
      }
      const data = await res.json();
      const text = data.content?.[0]?.text || "";
      const jsonMatch =
        text.match(/```json\s*([\s\S]*?)```/) ||
        text.match(/```\s*([\s\S]*?)```/) ||
        text.match(/(\{[\s\S]*\})/);
      const clean = jsonMatch ? jsonMatch[1].trim() : text.trim();
      const parsed = JSON.parse(clean);
      parsed.days = parsed.days.map(day => ({
        ...day,
        places: day.places.map(p => ({
          ...p,
          costKRW: foreignToKrw(Number(p.cost) || 0)
        }))
      }));
      setItinerary(parsed);
      setActiveDay(0);
    } catch (e) {
      setError(`일정 생성 실패: ${e.message}`);
    }
    setLoading(false);
  };

  const inp = {
    width: "100%", background: "#1A1A1A", border: "1px solid #333",
    borderRadius: "8px", padding: "11px 14px", color: "#F5F0E8",
    fontSize: "14px", outline: "none", boxSizing: "border-box",
  };
  const lbl = {
    fontSize: "11px", color: "#888", letterSpacing: "0.08em",
    textTransform: "uppercase", display: "block", marginBottom: "7px"
  };

  const rateDisplay = exchangeRate
    ? `1 ${currency} = ${Math.round(1/exchangeRate).toLocaleString()}원`
    : rateLoading ? "환율 조회 중..." : "";

  return (
    <div style={{ minHeight: "100vh", background: "#0D0D0D", fontFamily: "'Noto Sans KR', sans-serif", color: "#F5F0E8" }}>
      <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@300;400;500;700&family=Playfair+Display:ital,wght@0,700;1,400&display=swap" rel="stylesheet" />

      {/* Header */}
      <div style={{
        borderBottom: "1px solid #222", padding: "20px 32px",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        position: "sticky", top: 0, background: "rgba(13,13,13,0.95)",
        backdropFilter: "blur(12px)", zIndex: 100,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <span style={{ fontSize: "20px" }}>✈️</span>
          <span style={{ fontFamily: "'Playfair Display', serif", fontSize: "19px", color: "#E8472A", fontStyle: "italic" }}>AI Travel</span>
          <span style={{ color: "#555", fontSize: "13px" }}>플래너 + 경비계산</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          {rateDisplay && (
            <div style={{ fontSize: "12px", color: "#C9853A", background: "rgba(201,133,58,0.1)", padding: "5px 10px", borderRadius: "6px", border: "1px solid rgba(201,133,58,0.3)" }}>
              📈 {rateDisplay} {rateLoading ? "" : "(실시간)"}
            </div>
          )}
          {itinerary && (
            <div style={{ fontSize: "13px", color: "#888" }}>
              총 경비 <span style={{ color: "#E8472A", fontWeight: "700", fontSize: "15px" }}>{totalKRW.toLocaleString()}원</span>
            </div>
          )}
        </div>
      </div>

      <div style={{ maxWidth: "900px", margin: "0 auto", padding: "28px 20px" }}>

        {/* Input Card */}
        <div style={{ background: "#141414", border: "1px solid #222", borderRadius: "16px", padding: "28px", marginBottom: "24px" }}>
          <div style={{ fontFamily: "'Playfair Display', serif", fontSize: "26px", marginBottom: "24px", lineHeight: 1.2 }}>
            어디로 <span style={{ color: "#E8472A", fontStyle: "italic" }}>떠나실</span>건가요?
          </div>

          {/* City + exchange rate */}
          <div style={{ marginBottom: "20px" }}>
            <label style={lbl}>도시</label>
            <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
              <input value={city} onChange={e => setCity(e.target.value)}
                placeholder="예: 상하이, 시드니, 도쿄" style={{ ...inp, flex: 1 }} />
              {rateDisplay && (
                <div style={{ fontSize: "13px", color: "#C9853A", whiteSpace: "nowrap", padding: "11px 14px", background: "rgba(201,133,58,0.08)", border: "1px solid rgba(201,133,58,0.25)", borderRadius: "8px" }}>
                  {rateLoading ? "⏳ 조회중..." : `📈 ${rateDisplay}`}
                </div>
              )}
            </div>
          </div>

          {/* Flight times */}
          <div style={{ background: "#0F0F0F", border: "1px solid #2A2A2A", borderRadius: "12px", padding: "18px", marginBottom: "20px" }}>
            <div style={{ fontSize: "12px", color: "#E8472A", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: "14px" }}>✈️ 항공편 정보</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
              <div>
                <label style={{ ...lbl, color: "#5A9EC9" }}>🛬 도착 날짜</label>
                <input type="date" value={arrivalDate} onChange={e => setArrivalDate(e.target.value)} style={{ ...inp, colorScheme: "dark" }} />
              </div>
              <div>
                <label style={{ ...lbl, color: "#5A9EC9" }}>🛬 도착 시간</label>
                <div style={{ display: "flex", gap: "8px" }}>
                  <select value={arrivalHour} onChange={e => setArrivalHour(e.target.value)} style={{ ...inp, flex: 1, cursor: "pointer" }}>
                    {Array.from({length: 24}, (_, i) => String(i).padStart(2,"0")).map(h => <option key={h} value={h}>{h}시</option>)}
                  </select>
                  <select value={arrivalMin} onChange={e => setArrivalMin(e.target.value)} style={{ ...inp, flex: 1, cursor: "pointer" }}>
                    {Array.from({length: 60}, (_, i) => String(i).padStart(2,"0")).map(m => <option key={m} value={m}>{m}분</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label style={{ ...lbl, color: "#E87A5A" }}>🛫 출발 날짜</label>
                <input type="date" value={departureDate} onChange={e => setDepartureDate(e.target.value)} style={{ ...inp, colorScheme: "dark" }} />
              </div>
              <div>
                <label style={{ ...lbl, color: "#E87A5A" }}>🛫 출발 시간</label>
                <div style={{ display: "flex", gap: "8px" }}>
                  <select value={departureHour} onChange={e => setDepartureHour(e.target.value)} style={{ ...inp, flex: 1, cursor: "pointer" }}>
                    {Array.from({length: 24}, (_, i) => String(i).padStart(2,"0")).map(h => <option key={h} value={h}>{h}시</option>)}
                  </select>
                  <select value={departureMin} onChange={e => setDepartureMin(e.target.value)} style={{ ...inp, flex: 1, cursor: "pointer" }}>
                    {Array.from({length: 60}, (_, i) => String(i).padStart(2,"0")).map(m => <option key={m} value={m}>{m}분</option>)}
                  </select>
                </div>
              </div>
            </div>
            {tripDays && (
              <div style={{ marginTop: "12px", fontSize: "13px", color: "#888", textAlign: "center" }}>
                📅 총 <span style={{ color: "#F5F0E8", fontWeight: "600" }}>{tripDays}일</span> 여행
                {arrivalDate && departureDate && (
                  <span style={{ color: "#555" }}> · {formatDate(arrivalDate)} ~ {formatDate(departureDate)}</span>
                )}
              </div>
            )}
          </div>

          {/* Budget + Style */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: "16px", marginBottom: "20px" }}>
            <div>
              <label style={lbl}>예산 (만원, 선택)</label>
              <input value={budget} onChange={e => setBudget(e.target.value)} placeholder="예: 80" type="number" style={inp} />
            </div>
            <div>
              <label style={lbl}>여행 스타일</label>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                {styleOptions.map(s => (
                  <button key={s} onClick={() => toggleStyle(s)} style={{
                    padding: "7px 12px", borderRadius: "20px", fontSize: "12px",
                    border: styleList.includes(s) ? "1px solid #E8472A" : "1px solid #333",
                    background: styleList.includes(s) ? "rgba(232,71,42,0.15)" : "#1A1A1A",
                    color: styleList.includes(s) ? "#E8472A" : "#888",
                    cursor: "pointer", transition: "all 0.2s",
                  }}>{s}</button>
                ))}
              </div>
            </div>
          </div>

          <button onClick={generate} disabled={loading} style={{
            width: "100%", padding: "16px",
            background: loading ? "#333" : "linear-gradient(135deg, #E8472A, #C9853A)",
            border: "none", borderRadius: "10px", color: "#fff",
            fontSize: "16px", fontWeight: "700", cursor: loading ? "not-allowed" : "pointer",
          }}>
            {loading ? "✨ AI가 일정을 짜는 중..." : "🗺️ AI 일정 + 경비 생성하기"}
          </button>
          {error && <div style={{ color: "#E8472A", fontSize: "13px", marginTop: "12px", textAlign: "center" }}>{error}</div>}
        </div>

        {/* Loading */}
        {loading && (
          <div style={{ textAlign: "center", padding: "60px 0", color: "#555" }}>
            <div style={{ fontSize: "48px", marginBottom: "16px", animation: "spin 2s linear infinite", display: "inline-block" }}>🌏</div>
            <div style={{ fontSize: "15px" }}>{city} 항공 시간 기반 일정 생성 중...</div>
            <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
          </div>
        )}

        {/* Result */}
        {itinerary && (
          <div>
            {/* Trip Title */}
            <div style={{ background: "linear-gradient(135deg, #1A0A08, #1A1008)", border: "1px solid #3A1A10", borderRadius: "16px", padding: "24px 28px", marginBottom: "20px" }}>
              <div style={{ fontFamily: "'Playfair Display', serif", fontSize: "24px", marginBottom: "6px" }}>{itinerary.title}</div>
              <div style={{ color: "#888", fontSize: "14px", marginBottom: "8px" }}>{itinerary.summary}</div>
              <div style={{ display: "flex", gap: "16px", fontSize: "12px", color: "#666" }}>
                <span>🛬 도착 {arrivalDate} {arrivalTime}</span>
                <span>🛫 출발 {departureDate} {departureTime}</span>
                {exchangeRate && <span style={{ color: "#C9853A" }}>📈 1{currency} = {Math.round(1/exchangeRate).toLocaleString()}원</span>}
              </div>
            </div>

            {/* Budget Summary */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "20px" }}>
              <div style={{ background: "#141414", border: "1px solid #222", borderRadius: "12px", padding: "20px" }}>
                <div style={{ fontSize: "11px", color: "#888", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: "8px" }}>총 예상 경비</div>
                <div style={{ fontSize: "28px", fontWeight: "700", color: "#E8472A" }}>{totalKRW.toLocaleString()}<span style={{ fontSize: "16px" }}>원</span></div>
                <div style={{ fontSize: "12px", color: "#555", marginTop: "4px" }}>1인 기준 · 실시간 환율 적용</div>
              </div>
              <div style={{ background: "#141414", border: "1px solid #222", borderRadius: "12px", padding: "20px" }}>
                <div style={{ fontSize: "11px", color: "#888", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: "10px" }}>카테고리별 비용</div>
                {Object.entries(categoryTotals).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([cat, amt]) => (
                  <div key={cat} style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px", fontSize: "13px" }}>
                    <span style={{ color: getCategoryColor(cat) }}>{cat}</span>
                    <span style={{ color: "#aaa" }}>{amt.toLocaleString()}원</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Day Tabs */}
            <div style={{ display: "flex", gap: "8px", marginBottom: "16px", overflowX: "auto", paddingBottom: "4px" }}>
              {itinerary.days.map((d, i) => (
                <button key={i} onClick={() => setActiveDay(i)} style={{
                  padding: "9px 16px", borderRadius: "8px", fontSize: "12px", whiteSpace: "nowrap",
                  border: activeDay === i ? "1px solid #E8472A" : "1px solid #333",
                  background: activeDay === i ? "rgba(232,71,42,0.15)" : "#141414",
                  color: activeDay === i ? "#E8472A" : "#888",
                  cursor: "pointer",
                }}>
                  <div>Day {d.day}</div>
                  {d.date && <div style={{ fontSize: "10px", opacity: 0.7 }}>{d.date}</div>}
                </button>
              ))}
            </div>

            {/* Day Detail */}
            {itinerary.days[activeDay] && (
              <div style={{ background: "#141414", border: "1px solid #222", borderRadius: "16px", padding: "24px", marginBottom: "20px" }}>
                <div style={{ marginBottom: "20px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div>
                      <span style={{ fontSize: "11px", color: "#E8472A", letterSpacing: "0.1em" }}>Day {itinerary.days[activeDay].day} · {itinerary.days[activeDay].date}</span>
                      <div style={{ fontFamily: "'Playfair Display', serif", fontSize: "20px", marginTop: "4px" }}>{itinerary.days[activeDay].theme}</div>
                    </div>
                  </div>
                  {itinerary.days[activeDay].note && (
                    <div style={{ marginTop: "8px", fontSize: "12px", color: "#C9853A", background: "rgba(201,133,58,0.08)", border: "1px solid rgba(201,133,58,0.2)", borderRadius: "6px", padding: "7px 12px" }}>
                      ✈️ {itinerary.days[activeDay].note}
                    </div>
                  )}
                </div>

                {itinerary.days[activeDay].places.map((place, i) => (
                  <div key={i} style={{ display: "flex", gap: "16px" }}>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: "48px", flexShrink: 0 }}>
                      <div style={{ width: "10px", height: "10px", borderRadius: "50%", background: getCategoryColor(place.category), marginTop: "4px", flexShrink: 0 }} />
                      {i < itinerary.days[activeDay].places.length - 1 && <div style={{ width: "1px", flex: 1, background: "#222", minHeight: "40px" }} />}
                    </div>
                    <div style={{ flex: 1, paddingBottom: "24px" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
                        <div>
                          <span style={{ fontSize: "11px", color: "#555", marginRight: "8px" }}>{place.time}</span>
                          <span style={{ fontSize: "11px", color: getCategoryColor(place.category) }}>{place.category}</span>
                        </div>
                        <div style={{ textAlign: "right" }}>
                          <div style={{ fontSize: "14px", fontWeight: "600" }}>{CURRENCY_SYMBOLS[currency]}{(Number(place.cost)||0).toLocaleString()}</div>
                          <div style={{ fontSize: "11px", color: "#555" }}>{(place.costKRW||0).toLocaleString()}원</div>
                        </div>
                      </div>
                      <div style={{ fontSize: "15px", fontWeight: "500", marginBottom: "4px" }}>{place.name}</div>
                      <div style={{ fontSize: "13px", color: "#777", marginBottom: "6px" }}>{place.description}</div>
                      {place.tip && (
                        <div style={{ fontSize: "12px", color: "#C9853A", background: "rgba(201,133,58,0.08)", borderLeft: "2px solid #C9853A", padding: "6px 10px", borderRadius: "0 6px 6px 0" }}>
                          💡 {place.tip}
                        </div>
                      )}
                    </div>
                  </div>
                ))}

                <div style={{ borderTop: "1px solid #222", paddingTop: "16px", display: "flex", justifyContent: "space-between" }}>
                  <span style={{ fontSize: "13px", color: "#555" }}>Day {itinerary.days[activeDay].day} 소계</span>
                  <span style={{ fontSize: "16px", fontWeight: "700" }}>
                    {itinerary.days[activeDay].places.reduce((s,p) => s+(p.costKRW||0), 0).toLocaleString()}원
                  </span>
                </div>
              </div>
            )}

            <button onClick={generate} style={{
              width: "100%", padding: "14px", background: "transparent",
              border: "1px solid #333", borderRadius: "10px", color: "#888", fontSize: "14px", cursor: "pointer",
            }}>🔄 다른 일정으로 다시 생성</button>
          </div>
        )}
      </div>
    </div>
  );
}
