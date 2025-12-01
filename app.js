let userLat = null;
let userLon = null;
let userIp = 'ไม่ทราบ IP'; 
let userAddress = {}; 
let earthquakeFeatures = []; 

const CACHE_KEY = 'earthquakeDataCache';
const CACHE_DURATION_MS = 3600000; 

// >>>>> [สำคัญ!] แทนที่ URL นี้ด้วย URL Web App ที่คุณได้จาก Google Apps Script <<<<<
const DISCORD_PROXY_URL = "YOUR_GOOGLE_APPS_SCRIPT_URL"; 
const MIN_MAGNITUDE_FOR_ALERT = 4.5; // แจ้งเตือน Discord เมื่อขนาด >= 4.5
// >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>

const locationElement = document.getElementById('user-location');
const statusElement = document.getElementById('location-status');
const resultsElement = document.getElementById('earthquake-results');
const ipElement = document.getElementById('ip-address');
const historyElement = document.getElementById('location-history'); 


// **********************************************
// ส่วนที่ 1: การจัดการช่องป้อนข้อความ (Input Logic)
// **********************************************

function displayInput() {
    const inputValue = document.getElementById('myInput').value;
    const outputElement = document.getElementById('outputMessage');

    if (inputValue.trim() === "") {
        outputElement.textContent = "คุณไม่ได้ป้อนข้อความใดๆ";
        outputElement.style.color = 'red';
    } else {
        outputElement.textContent = `ข้อความที่คุณพิมพ์คือ: "${inputValue}"`;
        outputElement.style.color = '#28a745';
    }
    document.getElementById('myInput').value = ''; 
}


// **********************************************
// ส่วนที่ 2: การจัดการประวัติการค้นหา (Shared History Logic)
// **********************************************

// ----------------- [แก้ไข: ส่งข้อมูลไปบันทึกที่ Google Sheet] -----------------
async function saveLocationToHistory() {
    if (userLat === null || userLon === null || userAddress.province === undefined) {
        return; 
    }

    const historyEntry = {
        timestamp: Date.now(),
        timeString: new Date().toLocaleString('th-TH', { 
            year: 'numeric', 
            month: 'short', 
            day: 'numeric', 
            hour: '2-digit', 
            minute: '2-digit', 
            second: '2-digit' 
        }),
        lat: userLat.toFixed(6),
        lon: userLon.toFixed(6),
        ip: userIp,
        address: userAddress 
    };

    const payload = {
        action: "SAVE_HISTORY",
        payload: historyEntry
    };
    
    // ส่งข้อมูลไปบันทึกผ่าน Web App Proxy
    try {
        await fetch(DISCORD_PROXY_URL, {
            method: 'POST',
            mode: 'no-cors', 
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        displayHistory(); // แสดงผลประวัติใหม่ทันที
    } catch (e) {
        console.error("Failed to save history to Google Sheet:", e);
        // แสดงผลเฉพาะ Local Storage เดิมถ้าการบันทึกล้มเหลว (เผื่อกรณีฉุกเฉิน)
    }
}

// ----------------- [แก้ไข: ดึงข้อมูลจาก Google Sheet] -----------------
async function displayHistory() {
    historyElement.innerHTML = '<p style="color:#007bff;">กำลังดึงประวัติการค้นหาจากฐานข้อมูลส่วนกลาง...</p>';
    
    try {
        // ใช้ GET request เพื่อดึงข้อมูลประวัติ
        const response = await fetch(`${DISCORD_PROXY_URL}?action=GET_HISTORY`);
        
        if (!response.ok) {
            historyElement.innerHTML = '<p class="error">❌ ไม่สามารถเชื่อมต่อกับฐานข้อมูลประวัติได้ (HTTP Error)</p>';
            return;
        }

        const history = await response.json();
        
        if (!Array.isArray(history) || history.length === 0) {
            historyElement.innerHTML = '<p>ยังไม่มีประวัติการค้นหาตำแหน่งที่ถูกบันทึกไว้ในฐานข้อมูล</p>';
            return;
        }

        let historyHTML = '<ul style="list-style-type: none; padding-left: 0;">';
        history.forEach((item, index) => {
            const mainAddress = item.address.province !== 'ไม่ระบุ' 
                                ? `${item.address.province}, ${item.address.district}`
                                : item.address.road;

            historyHTML += `
                <li style="border-bottom: 1px dashed #ccc; padding: 8px 0;">
                    <strong style="color: #007bff;">#${index + 1}</strong> 
                    <strong>เวลา:</strong> ${item.timeString || item.timestamp}<br>
                    <strong>พิกัด:</strong> ${item.lat}, ${item.lon}<br>
                    <strong>ที่อยู่หลัก:</strong> ${mainAddress}<br>
                    <strong>IP:</strong> ${item.ip}
                </li>
            `;
        });
        historyHTML += '</ul>';
        historyElement.innerHTML = historyHTML;

    } catch (e) {
        console.error("Error fetching shared history:", e);
        historyElement.innerHTML = '<p class="error">❌ ข้อผิดพลาดในการโหลดประวัติจาก Web App Proxy. ตรวจสอบ URL</p>';
    }
}

// ----------------- [แก้ไข: ล้างประวัติไม่ได้แล้ว ต้องล้างใน Google Sheet โดยตรง] -----------------
function clearHistory() {
    alert('เนื่องจากประวัติถูกย้ายไปเก็บที่ Google Sheets ส่วนกลางแล้ว คุณต้องลบข้อมูลโดยตรงจาก Google Sheet ของคุณครับ');
}


// **********************************************
// ส่วนที่ 3: การคำนวณและดึงข้อมูลแผ่นดินไหว
// **********************************************

function calculateDistance(lat1, lon1, lat2, lon2) {
    // ... (โค้ดเดิม)
    const R = 6371; 
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon2 - lon1) * (Math.PI / 180);

    const a = 
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
        
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c; 
    return distance;
}

function fetchEarthquakeData() {
    // ... (โค้ดเดิม)
    resultsElement.innerHTML = '<p>กำลังดึงข้อมูลแผ่นดินไหว...</p>';
    
    const cachedData = localStorage.getItem(CACHE_KEY);
    if (cachedData) {
        try {
            const cache = JSON.parse(cachedData);
            if (Date.now() < cache.expiry) {
                earthquakeFeatures = cache.data;
                resultsElement.innerHTML = '<p>กำลังแสดงข้อมูลจากแคชที่บันทึกไว้ (ข้อมูลเก่า)...</p>';
                updateEarthquakeResults();
                return; 
            }
        } catch (e) {
            console.error("Failed to parse cache:", e);
        }
    }
    
    resultsElement.innerHTML = '<p>กำลังดึงข้อมูลแผ่นดินไหวจาก USGS (ออนไลน์)...</p>';
    const USGS_API = `https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson&starttime=now-7days&minmagnitude=2`;

    fetch(USGS_API)
        .then(response => {
            if (!response.ok) {
                throw new Error('ไม่สามารถเชื่อมต่อ API ข้อมูลแผ่นดินไหวได้');
            }
            return response.json();
        })
        .then(data => {
            earthquakeFeatures = data.features;
            
            const cacheToSave = {
                data: earthquakeFeatures,
                expiry: Date.now() + CACHE_DURATION_MS 
            };
            localStorage.setItem(CACHE_KEY, JSON.stringify(cacheToSave));
            
            updateEarthquakeResults();
        })
        .catch(error => {
            resultsElement.innerHTML = `<p class="error">❌ เกิดข้อผิดพลาดในการดึงข้อมูลออนไลน์: ${error.message}</p>`;
            if (cachedData) {
                 const cache = JSON.parse(cachedData);
                 earthquakeFeatures = cache.data;
                 resultsElement.innerHTML += '<p class="error">แสดงข้อมูลเก่าเนื่องจากไม่สามารถเชื่อมต่ออินเทอร์เน็ตได้</p>';
                 updateEarthquakeResults();
            }
        });
}

// ----------------- [แก้ไข: ส่ง Action DISCORD_ALERT ไป Web App] -----------------
function notifyDiscord(feature) {
    if (DISCORD_PROXY_URL === "YOUR_GOOGLE_APPS_SCRIPT_URL") return; 

    const props = feature.properties;
    const coords = feature.geometry.coordinates;
    const distanceText = feature.distance !== undefined ? `${feature.distance.toLocaleString('th-TH', { maximumFractionDigits: 0 })} กม.` : 'ไม่ระบุ';
    
    let color = 16777215; 
    if (props.mag >= 6.0) color = 16711680; 
    else if (props.mag >= 5.0) color = 16744448; 
    else if (props.mag >= 4.0) color = 16776960; 

    const discordPayload = {
        content: `🚨 แผ่นดินไหวขนาด ${props.mag.toFixed(1)} ใกล้ ${props.place}`,
        embeds: [{
            title: `Magnitude ${props.mag.toFixed(1)}: ${props.place}`,
            description: `เกิดขึ้นเมื่อ: ${new Date(props.time).toLocaleString('th-TH', { hour12: false, year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}`,
            color: color,
            fields: [
                { name: "📏 ระยะห่างจากคุณ", value: distanceText, inline: true },
                { name: "📍 พิกัด", value: `Lat: ${coords[1].toFixed(2)}, Lon: ${coords[0].toFixed(2)}`, inline: true },
                { name: "🌐 แหล่งที่มา", value: props.url || 'USGS', inline: false }
            ]
        }]
    };
    
    const finalPayload = {
        action: "DISCORD_ALERT",
        payload: discordPayload
    };

    fetch(DISCORD_PROXY_URL, {
        method: 'POST',
        mode: 'no-cors', 
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(finalPayload)
    }).catch(error => {
        console.error('Error sending Discord notification:', error);
    });
}


function updateEarthquakeResults() {
    resultsElement.innerHTML = ''; 

    if (earthquakeFeatures.length === 0) {
        resultsElement.innerHTML = '<p>ไม่พบแผ่นดินไหวขนาดตั้งแต่ 2.0 ขึ้นไปใน 7 วันที่ผ่านมา</p>';
        return;
    }
    
    if (userLat !== null && userLon !== null) {
        earthquakeFeatures.forEach(feature => {
            const eqLat = feature.geometry.coordinates[1];
            const eqLon = feature.geometry.coordinates[0];
            feature.distance = calculateDistance(userLat, userLon, eqLat, eqLon);
        });
        earthquakeFeatures.sort((a, b) => a.distance - b.distance);
    }
    
    const countHeader = document.createElement('h3');
    countHeader.textContent = `พบ ${earthquakeFeatures.length} เหตุการณ์ (แสดง 50 อันดับแรกที่ใกล้คุณที่สุด)`;
    resultsElement.appendChild(countHeader);

    earthquakeFeatures.slice(0, 50).forEach((feature, index) => {
        const props = feature.properties;
        
        // ตรวจสอบขนาดเพื่อแจ้งเตือน Discord
        if (props.mag >= MIN_MAGNITUDE_FOR_ALERT) {
            notifyDiscord(feature);
        }
        
        let magnitudeClass = (props.mag >= 4.0) ? 'mag-4-plus' : 'mag-2-to-4';
        // ... (โค้ดส่วนแสดงผล HTML เหมือนเดิม) ...
        const time = new Date(props.time).toLocaleString('th-TH', { 
            hour12: false, 
            year: 'numeric', 
            month: 'short', 
            day: 'numeric', 
            hour: '2-digit', 
            minute: '2-digit'
        });

        let distanceText = '';
        if (userLat !== null && userLon !== null && feature.distance !== undefined) {
            const distance = feature.distance; 
            distanceText = ` | 📏 ห่างจากคุณ ${distance.toLocaleString('th-TH', { maximumFractionDigits: 0 })} กม.`;
        } else {
            distanceText = ' | ❌ ไม่สามารถคำนวณระยะทาง';
        }

        const itemHTML = `
            <div class="earthquake-item">
                <span style="font-size: 1.1em; font-weight: bold; margin-right: 15px;">#${index + 1}</span>
                <div>
                    <span class="magnitude ${magnitudeClass}">ขนาด: ${props.mag.toFixed(1)}</span>
                    <strong style="font-size: 1.1em;">${props.place}</strong><br>
                    <small>⏰ ${time}${distanceText}</small>
                </div>
            </div>
        `;
        resultsElement.innerHTML += itemHTML;
    });
}


// **********************************************
// ส่วนที่ 4: Geolocation, IP และ Reverse Geocoding
// **********************************************

// ... (โค้ดส่วนนี้เหมือนเดิม: fetchIpAddress, getUserLocation, showPosition, showError)

function fetchIpAddress() {
    ipElement.innerHTML = 'กำลังค้นหา IP Address...';
    fetch('https://api.ipify.org?format=json')
        .then(response => response.json())
        .then(data => {
            userIp = data.ip; 
            ipElement.innerHTML = `🌐 **IP Address ของคุณ:** <span style="font-weight: bold; color: #007bff;">${userIp}</span>`;
        })
        .catch(error => {
            userIp = 'ไม่สามารถดึง IP'; 
            ipElement.innerHTML = `<span class="error">❌ ไม่สามารถดึง IP Address ได้</span>`;
            console.error('IP Fetch Error:', error);
        });
}


function getUserLocation() {
    if (navigator.geolocation) {
        statusElement.textContent = 'กำลังค้นหาตำแหน่ง...';
        locationElement.innerHTML = '';
        resultsElement.innerHTML = '<p>รอการระบุตำแหน่งเพื่อเริ่มดึงข้อมูลและคำนวณระยะทาง...</p>';

        fetchIpAddress(); 

        navigator.geolocation.getCurrentPosition(showPosition, showError, {
            enableHighAccuracy: true,
            timeout: 20000, 
            maximumAge: 0
        });
    } else {
        statusElement.textContent = '❌ เบราว์เซอร์นี้ไม่รองรับ Geolocation.';
    }
}

function showPosition(position) {
    userLat = position.coords.latitude;
    userLon = position.coords.longitude;
    
    statusElement.className = 'status';
    statusElement.textContent = '✅ ระบุตำแหน่งสำเร็จ';

    reverseGeocode(userLat, userLon);
    fetchEarthquakeData();
}

function reverseGeocode(lat, lon) {
    const nominatimUrl = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&addressdetails=1&accept-language=th`;

    locationElement.innerHTML = `**พิกัดปัจจุบัน:** ละติจูด ${lat.toFixed(6)}, ลองจิจูด ${lon.toFixed(6)}<br>กำลังค้นหาที่อยู่ภาษาไทย...`;

    fetch(nominatimUrl, {
        headers: {
            'User-Agent': 'Thai-Location-App-Example' 
        }
    })
    .then(response => response.json())
    .then(data => {
        const address = data.address;
        
        if (address) {
            userAddress = {
                country: address.country || 'ไม่ระบุ',
                province: address.state || address.province || 'ไม่ระบุ', 
                district: address.city || address.town || address.county || address.suburb || 'ไม่ระบุ',
                subDistrict: address.suburb || address.quarter || address.village || address.road || 'ไม่ระบุ',
                houseNumber: address.house_number || address.building || 'ไม่ระบุ',
                road: address.road || 'ไม่ระบุ'
            };
            
            const countryCode = address.country_code ? ` (${address.country_code.toUpperCase()})` : '';

            const thaiAddress = `
                <div style="border: 1px dashed #ccc; padding: 10px; margin-top: 10px;">
                    <h2>✅ ที่อยู่ภาษาไทยโดยละเอียด:</h2>
                    <p><strong>ประเทศ:</strong> ${userAddress.country}${countryCode}</p>
                    <p><strong>จังหวัด:</strong> ${userAddress.province}</p>
                    <p><strong>อำเภอ/เขต:</strong> ${userAddress.district}</p>
                    <p><strong>ตำบล/แขวง:</strong> ${userAddress.subDistrict}</p>
                    <p><strong>ถนน:</strong> ${userAddress.road}</p>
                    <p><strong>เลขที่/อาคาร:</strong> ${userAddress.houseNumber}</p> 
                    <hr>
                    <p><strong>พิกัดดิบ (Lat/Lon):</strong> ${lat.toFixed(6)}, ${lon.toFixed(6)}</p>
                </div>
            `;
            
            locationElement.innerHTML = thaiAddress;
            saveLocationToHistory(); 
        } else {
            userAddress = {}; 
            locationElement.innerHTML = `**พิกัดปัจจุบัน:** ละติจูด ${lat.toFixed(6)}, ลองจิจูด ${lon.toFixed(6)}<br><span class="error">ไม่พบข้อมูลที่อยู่โดยละเอียดสำหรับพิกัดนี้</span>`;
        }
    })
    .catch(error => {
        locationElement.innerHTML = `**พิกัดปัจจุบัน:** ละติจูด ${lat.toFixed(6)}, ลองจิจูด ${lon.toFixed(6)}<br><span class="error">มีข้อผิดพลาดในการค้นหาที่อยู่: ${error.message}</span>`;
    });
}

function showError(error) {
    let errorMessage = '';
    switch(error.code) {
        case error.PERMISSION_DENIED:
            errorMessage = "ผู้ใช้ปฏิเสธการเข้าถึงตำแหน่ง กรุณาอนุญาตการเข้าถึงตำแหน่งในเบราว์เซอร์ของคุณ";
            break;
        case error.POSITION_UNAVAILABLE:
            errorMessage = "ไม่สามารถหาข้อมูลตำแหน่งได้ (Position Unavailable)";
            break;
        case error.TIMEOUT:
            errorMessage = "หมดเวลาในการค้นหาตำแหน่ง (Timeout) กรุณาลองใหม่อีกครั้ง หรือตรวจสอบสัญญาณ GPS/อินเทอร์เน็ต";
            break;
        case error.UNKNOWN_ERROR:
            errorMessage = "เกิดข้อผิดพลาดที่ไม่ทราบสาเหตุ";
            break;
    }
    statusElement.className = 'error';
    statusElement.textContent = `❌ ข้อผิดพลาดในการระบุตำแหน่ง: ${errorMessage}`;
    locationElement.innerHTML = '';
    resultsElement.innerHTML = '<p class="error">การระบุตำแหน่งล้มเหลว จึงไม่สามารถดึงข้อมูลแผ่นดินไหวและคำนวณระยะทางได้</p>';
}

// เรียกแสดงประวัติเมื่อหน้าเว็บโหลด
document.addEventListener('DOMContentLoaded', displayHistory);
