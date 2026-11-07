
function createDevices() {

  return [
    { id: 1,  owner: "shared", room: "Living room", name: "Air conditioner", icon: "❄️", ratedWatts: 1200, isOn: true,  kwhToday: 5.2 },
    { id: 2,  owner: "dad",    room: "Living room", name: "TV",              icon: "📺", ratedWatts: 120,  isOn: true,  kwhToday: 0.5 },
    { id: 3,  owner: "shared", room: "Living room", name: "Ceiling lights",  icon: "💡", ratedWatts: 60,   isOn: true,  kwhToday: 0.3 },
    { id: 4,  owner: "mum",    room: "Bedroom",     name: "Air conditioner", icon: "❄️", ratedWatts: 900,  isOn: false, kwhToday: 1.8 },
    { id: 5,  owner: "shared", room: "Kitchen",     name: "Fridge",          icon: "🧊", ratedWatts: 150,  isOn: true,  kwhToday: 1.6 },
    { id: 6,  owner: "mum",    room: "Kitchen",     name: "Microwave",       icon: "🍲", ratedWatts: 1000, isOn: false, kwhToday: 0.2 },
    { id: 7,  owner: "shared", room: "Kitchen",     name: "Lights",          icon: "💡", ratedWatts: 45,   isOn: true,  kwhToday: 0.3 },
    { id: 8,  owner: "alex",   room: "Kids' room",  name: "Computer",        icon: "💻", ratedWatts: 200,  isOn: true,  kwhToday: 0.9 },
    { id: 9,  owner: "alex",   room: "Kids' room",  name: "Lights",          icon: "💡", ratedWatts: 30,   isOn: true,  kwhToday: 0.2 },
    { id: 10, owner: "shared", room: "Laundry",     name: "Water heater",    icon: "🔥", ratedWatts: 1800, isOn: false, kwhToday: 1.4 },
    { id: 11, owner: "dad",    room: "Home office", name: "Laptop and monitor", icon: "🖥️", ratedWatts: 110, isOn: true, kwhToday: 0.8 },
  ];
}

const HOURLY_PATTERN = [0.2, 0.2, 0.2, 0.2, 0.2, 0.3, 0.6, 0.9, 0.7, 0.5, 0.5, 0.6,
                        0.8, 0.7, 0.6, 0.7, 0.9, 1.2, 1.5, 1.4, 1.1, 0.8, 0.4, 0.3];

const PAST_DAYS_KWH = [11.2, 9.8, 10.5, 12.9, 15.3, 16.1];
const PAST_DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const HIGH_USAGE_MULTIPLIER = 1.5;   // a device is "too high" above 150% of its normal watts
const HIGH_HOME_WATTS = 3200;        // the whole home is "too high" above this
const UPDATE_EVERY_MS = 2000;
const SIMULATED_MINUTES_PER_UPDATE = 1 / 30; // makes kWh visibly grow in the demo

let devices = createDevices();
let pricePerKwh = 0.15;
let chartRange = "day";        // "day" or "week"
let spikingDeviceId = null;    // the device we are pretending is misbehaving
let dismissedAlerts = new Set();

const PEOPLE = [
  { id: "all",  name: "Everyone", emoji: "🏠" },
  { id: "mum",  name: "Mum",      emoji: "👩" },
  { id: "dad",  name: "Dad",      emoji: "👨" },
  { id: "alex", name: "Alex",     emoji: "🧒" },
];
const FAMILY_SIZE = PEOPLE.length - 1;   // "Everyone" is not a person
let selectedPersonId = "all";

const $ = (id) => document.getElementById(id);
const formatMoney = (amount) => "$" + amount.toFixed(2);
const sum = (numbers) => numbers.reduce((total, n) => total + n, 0);

function weightOf(device) {
  if (selectedPersonId === "all" || device.owner === selectedPersonId) return 1;
  if (device.owner === "shared") return 1 / FAMILY_SIZE;
  return 0;
}

function getVisibleDevices() {
  return devices.filter((device) => weightOf(device) > 0);
}

function getHomeShareRatio() {
  return getTotalKwh() / sum(devices.map((d) => d.kwhToday));
}

function formatWatts(watts) {
  return watts >= 1000 ? (watts / 1000).toFixed(2) + " kW" : Math.round(watts) + " W";
}

function randomBetween(min, max) {
  return min + Math.random() * (max - min);
}

function readWatts(device) {
  if (!device.isOn) return 0;
  let watts = device.ratedWatts * randomBetween(0.92, 1.08);
  if (device.name === "Fridge") watts = device.ratedWatts * randomBetween(0.5, 1.1); // fridges cycle on and off
  if (device.id === spikingDeviceId) watts *= 1.9;
  return watts;
}

function updateReadings() {
  devices.forEach((device) => {
    device.currentWatts = readWatts(device);
    device.kwhToday += (device.currentWatts / 1000) * SIMULATED_MINUTES_PER_UPDATE;
  });
}

function getTotalWatts() {
  return sum(devices.map((d) => d.currentWatts * weightOf(d)));
}

function getTotalKwh() {
  return sum(devices.map((d) => d.kwhToday * weightOf(d)));
}

function getRoomTotals() {
  const rooms = {};
  getVisibleDevices().forEach((device) => {
    if (!rooms[device.room]) rooms[device.room] = { watts: 0, kwh: 0 };
    rooms[device.room].watts += device.currentWatts * weightOf(device);
    rooms[device.room].kwh += device.kwhToday * weightOf(device);
  });
  return rooms;
}

function estimateMonthlyCost() {
  const averageDailyKwh = (sum(PAST_DAYS_KWH) / PAST_DAYS_KWH.length) * getHomeShareRatio();
  return averageDailyKwh * 30 * pricePerKwh;
}

function findAlerts() {
  const alerts = [];
  const hour = new Date().getHours();

  getVisibleDevices().forEach((device) => {
    const isTooHigh = device.isOn && device.currentWatts > device.ratedWatts * HIGH_USAGE_MULTIPLIER;
    if (isTooHigh && !dismissedAlerts.has(device.id)) {
      alerts.push({
        key: device.id,
        title: `${device.room}: the ${device.name.toLowerCase()} is using ${formatWatts(device.currentWatts)}`,
        detail: `That's well above its usual ${formatWatts(device.ratedWatts)}. It may be working too hard.`,
        action: "Turn it off",
        deviceId: device.id,
      });
    }
  });

  if (getTotalWatts() > HIGH_HOME_WATTS && alerts.length === 0 && !dismissedAlerts.has("home")) {
    alerts.push({
      key: "home",
      title: `Your home is using ${formatWatts(getTotalWatts())} right now`,
      detail: "Several big appliances are running at once. Try spacing them out.",
      action: "Got it",
    });
  }

  const kidsLights = devices.find((d) => d.room === "Kids' room" && d.name === "Lights");
  if (weightOf(kidsLights) > 0 && kidsLights.isOn && hour >= 9 && hour < 17 && !dismissedAlerts.has("kids-lights")) {
    alerts.push({
      key: "kids-lights",
      title: "Lights are on in the kids' room during the day",
      detail: "Probably nobody's in there. Worth a quick check.",
      action: "Switch off",
      deviceId: kidsLights.id,
    });
  }

  return alerts;
}

function buildTips() {
  const tips = [];
  const airConditioners = getVisibleDevices().filter((d) => d.name === "Air conditioner");
  const acCost = sum(airConditioners.map((d) => d.kwhToday * weightOf(d))) * pricePerKwh;

  if (airConditioners.length > 0) tips.push(["❄️", `Air conditioning has cost you ${formatMoney(acCost)} today. Setting it 1°C warmer can cut its use by roughly 6–8%.`]);

  if (getVisibleDevices().some((d) => d.name === "TV" && d.isOn)) {
    tips.push(["📺", "TVs and computers still use power in standby. A power strip makes “off” truly off."]);
  }
  tips.push(["💡", "Switching to LED bulbs can cut lighting energy by about 75%."]);
  tips.push(["🧺", "Run the laundry and water heater in the morning or late evening, when demand is usually lower."]);
  return tips;
}

function renderSummary() {
  const hour = new Date().getHours();
  const timeOfDay = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const person = PEOPLE.find((p) => p.id === selectedPersonId);
  const rooms = getRoomTotals();
  const busiestRoom = Object.keys(rooms).sort((a, b) => rooms[b].kwh - rooms[a].kwh)[0];
  const biggestDevice = [...getVisibleDevices()].sort((a, b) => b.kwhToday * weightOf(b) - a.kwhToday * weightOf(a))[0];
  const biggestText = `the ${biggestDevice.name.toLowerCase()} in the ${biggestDevice.room.toLowerCase()}`;

  if (person.id === "all") {
    $("greeting").textContent = `${timeOfDay}, everyone`;
    $("summary").textContent = `${busiestRoom} is your busiest room today. The biggest single energy user is ${biggestText}.`;
  } else {
    $("greeting").textContent = `${timeOfDay}, ${person.name}`;
    $("summary").textContent =
      `Your part of today's bill so far is ${formatMoney(getTotalKwh() * pricePerKwh)}. ` +
      `Your biggest energy user is ${biggestText}.`;
  }
}

function renderLiveNumbers() {
  const watts = getTotalWatts();
  const kwh = getTotalKwh();

  $("live-watts").textContent = formatWatts(watts);
  $("live-badge").textContent = watts > HIGH_HOME_WATTS ? "whoa" : watts > 1800 ? "busy" : "calm";
  $("kwh-today").textContent = kwh.toFixed(1);
  $("cost-today").textContent = formatMoney(kwh * pricePerKwh);
  $("cost-month").textContent = "$" + Math.round(estimateMonthlyCost());
}

function renderAlerts() {
  const alerts = findAlerts();
  if (alerts.length === 0) {
    $("alerts").innerHTML = `<div class="all-quiet">All quiet. Nothing is using more than usual.</div>`;
    return;
  }
  $("alerts").innerHTML = alerts.map((alert) => `
    <div class="alert">
      <strong>${alert.title}</strong>
      <small>${alert.detail}</small><br>
      <button data-alert="${alert.key}" data-device="${alert.deviceId ?? ""}">${alert.action}</button>
    </div>`).join("");
}

function renderChart() {
  let values, labels, currentIndex;
  const ratio = getHomeShareRatio();

  if (chartRange === "day") {
    const hour = new Date().getHours();
    // Past hours use the typical pattern; the current hour uses the live reading
    values = HOURLY_PATTERN.map((kwh, h) => (h < hour ? kwh * ratio : h === hour ? getTotalWatts() / 1000 : 0));
    labels = HOURLY_PATTERN.map((_, h) => (h % 6 === 0 ? (h === 0 ? "12a" : h < 12 ? h + "a" : h === 12 ? "12p" : h - 12 + "p") : ""));
    currentIndex = hour;
    $("chart-title").textContent = "Your day, hour by hour";
    $("chart-note").textContent = "Evenings are when your home works hardest.";
  } else {
    values = [...PAST_DAYS_KWH.map((kwh) => kwh * ratio), getTotalKwh()];
    labels = [...PAST_DAY_NAMES, "Today"];
    currentIndex = values.length - 1;
    const average = (sum(PAST_DAYS_KWH) / PAST_DAYS_KWH.length) * ratio;
    $("chart-title").textContent = "Your week at a glance";
    $("chart-note").textContent = `You usually use about ${average.toFixed(1)} kWh a day (${formatMoney(average * pricePerKwh)}).`;
  }

  const tallest = Math.max(...values, 1);
  $("chart").innerHTML = values.map((value, i) =>
    `<div class="bar ${i === currentIndex ? "current" : ""}" style="height:${(value / tallest) * 100}%" title="${value.toFixed(1)} kWh"></div>`
  ).join("");
  $("chart-labels").innerHTML = labels.map((label) => `<span>${label}</span>`).join("");
}

function renderRooms() {
  const rooms = getRoomTotals();
  const biggestKwh = Math.max(...Object.values(rooms).map((r) => r.kwh));

  $("rooms").innerHTML = Object.entries(rooms).map(([name, room]) => `
    <div class="room">
      <div class="room-header">
        <span>${name}</span>
        <span>${formatWatts(room.watts)} · ${formatMoney(room.kwh * pricePerKwh)} today</span>
      </div>
      <div class="meter"><div class="meter-fill" style="width:${(room.kwh / biggestKwh) * 100}%"></div></div>
    </div>`).join("");
}

function renderDevices() {
  $("devices").innerHTML = getVisibleDevices().map((device) => {
    const ownerName = device.owner === "shared" ? "Shared" : PEOPLE.find((p) => p.id === device.owner).name;
    return `
    <div class="device">
      <span class="device-icon">${device.icon}</span>
      <div class="device-info">
        <strong>${device.name}</strong>
        <small>${device.room} · ${ownerName} · ${device.kwhToday.toFixed(1)} kWh today</small>
      </div>
      <span class="device-watts">${device.isOn ? formatWatts(device.currentWatts) : "off"}</span>
      <button class="switch ${device.isOn ? "on" : ""}" data-toggle="${device.id}"
              role="switch" aria-checked="${device.isOn}"
              aria-label="${device.name}, ${device.room}"></button>
    </div>`;
  }).join("");
}

function renderPeople() {
  $("people").innerHTML = PEOPLE.map((person) => `
    <button class="person-chip ${person.id === selectedPersonId ? "active" : ""}" data-person="${person.id}">
      <span>${person.emoji}</span>${person.name}
    </button>`).join("");
}

function renderClock() {
  $("clock").textContent = new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function renderTips() {
  $("tips").innerHTML = buildTips().map(([icon, text]) =>
    `<div class="tip"><span>${icon}</span><span>${text}</span></div>`
  ).join("");
}

function renderAll() {
  renderPeople();
  renderClock();
  renderSummary();
  renderLiveNumbers();
  renderAlerts();
  renderChart();
  renderRooms();
  renderDevices();
  renderTips();
}

function refresh() {
  updateReadings();
  renderAll();
}

function switchOff(deviceId) {
  const device = devices.find((d) => d.id === Number(deviceId));
  if (!device) return;
  device.isOn = false;
  if (spikingDeviceId === device.id) spikingDeviceId = null;
}

document.addEventListener("click", (event) => {
  const alertButton = event.target.closest("[data-alert]");
  const toggleButton = event.target.closest("[data-toggle]");
  const personButton = event.target.closest("[data-person]");

  if (alertButton) {
    if (alertButton.dataset.device) switchOff(alertButton.dataset.device);
    dismissedAlerts.add(Number(alertButton.dataset.alert) || alertButton.dataset.alert);
    refresh();
  }

  if (personButton) {
    selectedPersonId = personButton.dataset.person;
    renderAll();
  }

  if (toggleButton) {
    const device = devices.find((d) => d.id === Number(toggleButton.dataset.toggle));
    device.isOn = !device.isOn;
    if (!device.isOn && spikingDeviceId === device.id) spikingDeviceId = null;
    refresh();
  }
});

$("spike-btn").addEventListener("click", () => {
  devices[0].isOn = true;            // the living room air conditioner
  spikingDeviceId = devices[0].id;
  dismissedAlerts.delete(devices[0].id);
  refresh();
});

$("reset-btn").addEventListener("click", () => {
  devices = createDevices();
  spikingDeviceId = null;
  dismissedAlerts = new Set();
  refresh();
});

$("rate-input").addEventListener("input", (event) => {
  pricePerKwh = Math.max(0.01, parseFloat(event.target.value) || 0.15);
  renderAll();
});

function setViewMode(isDisplay) {
  document.body.classList.toggle("display-mode", isDisplay);
  $("display-view-btn").classList.toggle("active", isDisplay);
  $("phone-view-btn").classList.toggle("active", !isDisplay);
}
$("phone-view-btn").addEventListener("click", () => setViewMode(false));
$("display-view-btn").addEventListener("click", () => setViewMode(true));

function setChartRange(range) {
  chartRange = range;
  $("day-btn").classList.toggle("active", range === "day");
  $("week-btn").classList.toggle("active", range === "week");
  renderChart();
}
$("day-btn").addEventListener("click", () => setChartRange("day"));
$("week-btn").addEventListener("click", () => setChartRange("week"));

setViewMode(window.innerWidth >= 1000);   // big screens start as the wall display
refresh();
setInterval(refresh, UPDATE_EVERY_MS);
setInterval(renderClock, 1000);