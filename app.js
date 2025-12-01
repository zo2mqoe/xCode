let userLat = null;
let userLon = null;
let earthquakeFeatures = []; 
const CACHE_KEY = 'earthquakeDataCache';
const CACHE_DURATION_MS = 3600000; // 1 ชั่วโมง

const locationElement = document.getElementById('user-location');
const statusElement = document.getElementById('location-status');
const resultsElement = document.getElementById('earthquake-results');


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
// ส่วนที่ 2: การคำนวณและดึงข้อมูลแผ่นดินไหว
// **********************************************

function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // รัศมีโลกโดยเฉลี่ยในหน่วยกิโลเมตร
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon2 - lon1) * (Math.PI / 180);

    const a = 
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
        
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c; 
    return distance;
}

// ดึงข้อมูลแผ่นดินไหวจาก API หรือ Cache (รองรับออฟไลน์)
function fetchEarthquakeData() {
    resultsElement.innerHTML = '<p>กำลังดึงข้อมูลแผ่นดินไหว...</p>';
    
    // 1. ตรวจสอบ Local Storage (Cache)
    const cachedData = localStorage.getItem(CACHE_KEY);
    if (cachedData) {
        try {
            const cache = JSON.parse(cachedData);
            if (Date.now() < cache.expiry) {
                earthquakeFeatures = cache.data;
                resultsElement.innerHTML = '<p>กำลังแสดงข้อมูลจากแคชที่บันทึกไว้ (ใช้งานออฟไลน์/ข้อมูลอาจเก่า)...</p>';
                updateEarthquakeResults();
                return; 
            }
        } catch (e) {
            console.error("Failed to parse cache:", e);
        }
    }
    
    // 2. ดึงข้อมูลออนไลน์
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
            
            // 3. บันทึกข้อมูลลงใน Local Storage
            const cacheToSave = {
                data: earthquakeFeatures,
                expiry: Date.now() + CACHE_DURATION_MS 
            };
            localStorage.setItem(CACHE_KEY, JSON.stringify(cacheToSave));
            
            updateEarthquakeResults();
        })
        .catch(error => {
            resultsElement.innerHTML = `<p class="error">❌ เกิดข้อผิดพลาดในการดึงข้อมูลออนไลน์: ${error.message}</p>`;
            
            // 4. ถ้าดึงออนไลน์ล้มเหลว ให้ลองโหลดแคชที่หมดอายุมาแสดงแทน
            if (cachedData) {
                 const cache = JSON.parse(cachedData);
                 earthquakeFeatures = cache.data;
                 resultsElement.innerHTML += '<p class="error">แสดงข้อมูลเก่าเนื่องจากไม่สามารถเชื่อมต่ออินเทอร์เน็ตได้</p>';
                 updateEarthquakeResults();
            }
        });
}


// แสดงผลและคำนวณระยะทางแผ่นดินไหว (Ranking)
function updateEarthquakeResults() {
    resultsElement.innerHTML = ''; 

    if (earthquakeFeatures.length === 0) {
        resultsElement.innerHTML = '<p>ไม่พบแผ่นดินไหวขนาดตั้งแต่ 2.0 ขึ้นไปใน 7 วันที่ผ่านมา</p>';
        return;
    }
    
    // คำนวณระยะทางและเรียงลำดับ (Ranking)
    if (userLat !== null && userLon !== null) {
        earthquakeFeatures.forEach(feature => {
            const eqLat = feature.geometry.coordinates[1];
            const eqLon = feature.geometry.coordinates[0];
            feature.distance = calculateDistance(userLat, userLon, eqLat, eqLon);
        });
        // เรียงลำดับจากใกล้ไปไกล (ลำดับที่ 1 คือใกล้ที่สุด)
        earthquakeFeatures.sort((a, b) => a.distance - b.distance);
    }
    
    const countHeader = document.createElement('h3');
    countHeader.textContent = `พบ ${earthquakeFeatures.length} เหตุการณ์ (แสดง 50 อันดับแรกที่ใกล้คุณที่สุด)`;
    resultsElement.appendChild(countHeader);

    // วนแสดงผล (แสดงแค่ 50 เหตุการณ์แรก)
    earthquakeFeatures.slice(0, 50).forEach((feature, index) => {
        const props = feature.properties;
        
        let magnitudeClass = (props.mag >= 4.0) ? 'mag-4-plus' : 'mag-2-to-4';

        const time = new Date(props.time).toLocaleString('th-TH', { 
            hour12: false, 
            year: 'numeric', 
            month: 'short', 
            day: 'numeric', 
            hour: '2-digit', 
            minute: '2-digit'
        });

        // แสดงระยะทาง
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
// ส่วนที่ 3: Geolocation และ Reverse Geocoding (Timeout 20s)
// **********************************************

// ฟังก์ชันหลักในการขอตำแหน่งปัจจุบัน
function getUserLocation() {
    if (navigator.geolocation) {
        statusElement.textContent = 'กำลังค้นหาตำแหน่ง...';
        locationElement.innerHTML = '';
        resultsElement.innerHTML = '<p>รอการระบุตำแหน่งเพื่อเริ่มดึงข้อมูลและคำนวณระยะทาง...</p>';

        // **ตั้งค่า Timeout เป็น 20 วินาที**
        navigator.geolocation.getCurrentPosition(showPosition, showError, {
            enableHighAccuracy: true,
            timeout: 20000, 
            maximumAge: 0
        });
    } else {
        statusElement.textContent = '❌ เบราว์เซอร์นี้ไม่รองรับ Geolocation.';
    }
}

// ฟังก์ชันเมื่อได้รับตำแหน่งสำเร็จ
function showPosition(position) {
    userLat = position.coords.latitude;
    userLon = position.coords.longitude;
    
    statusElement.className = 'status';
    statusElement.textContent = '✅ ระบุตำแหน่งสำเร็จ';

    // 1. เรียก Reverse Geocoding เพื่อแสดงที่อยู่ภาษาไทย
    reverseGeocode(userLat, userLon);
    
    // 2. เรียกดึงข้อมูลแผ่นดินไหวและคำนวณระยะทาง
    fetchEarthquakeData();
}

// ฟังก์ชันสำหรับ Reverse Geocoding
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
            const country = address.country || 'ไม่ระบุ';
            const province = address.state || address.province || 'ไม่ระบุ'; 
            const district = address.city || address.town || address.county || address.suburb || 'ไม่ระบุ';
            const subDistrict = address.suburb || address.quarter || address.village || address.road || 'ไม่ระบุ';
            
            const countryCode = address.country_code ? ` (${address.country_code.toUpperCase()})` : '';

            const thaiAddress = `
                <div style="border: 1px dashed #ccc; padding: 10px; margin-top: 10px;">
                    <h2>✅ ที่อยู่ภาษาไทยโดยละเอียด:</h2>
                    <p><strong>ประเทศ:</strong> ${country}${countryCode}</p>
                    <p><strong>จังหวัด:</strong> ${province}</p>
                    <p><strong>อำเภอ/เขต:</strong> ${district}</p>
                    <p><strong>ตำบล/แขวง/ถนน:</strong> ${subDistrict}</p>
                </div>
            `;
            
            locationElement.innerHTML = thaiAddress;
        } else {
            locationElement.innerHTML = `**พิกัดปัจจุบัน:** ละติจูด ${lat.toFixed(6)}, ลองจิจูด ${lon.toFixed(6)}<br><span class="error">ไม่พบข้อมูลที่อยู่โดยละเอียดสำหรับพิกัดนี้</span>`;
        }
    })
    .catch(error => {
        locationElement.innerHTML = `**พิกัดปัจจุบัน:** ละติจูด ${lat.toFixed(6)}, ลองจิจูด ${lon.toFixed(6)}<br><span class="error">มีข้อผิดพลาดในการค้นหาที่อยู่: ${error.message}</span>`;
    });
}

// ฟังก์ชันเมื่อเกิดข้อผิดพลาดในการขอตำแหน่ง
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