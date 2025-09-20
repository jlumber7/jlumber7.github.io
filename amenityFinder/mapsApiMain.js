//Initialise the map
const map = L.map('map').setView([51.505, -0.09], 13); // Default: London

// Add OpenStreetMap tiles
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {attribution: '&copy; OpenStreetMap contributors'}).addTo(map);

var distanceFromLoc = 1000;
var userCoords = [51.505, -0.09];
let userMarker = null;
var amenity = "";
var amenityMarkers = [];

//Function to make the API call to find the amenities around the location
async function checkAmenities()
{
  try
  {
    //Updates the coordinates to search around and remove old markers
    const center = map.getCenter();
    userCoords[0] = center.lat;
    userCoords[1] = center.lng;

    amenityMarkers.forEach(m => map.removeLayer(m));
    amenityMarkers = [];

    //Sends the fetch request to the API
    const res = await fetch(
        "https://overpass-api.de/api/interpreter",
        {
            method: "POST",
            body: "data="+ encodeURIComponent(`
                [out:json]
                [timeout:25];
                node
                ["amenity"~${amenity}]
                (around:${distanceFromLoc},${userCoords[0]},${userCoords[1]});
                out body;`)
        });

      const data = await res.json();

      data.elements.forEach(place => {
        if (place.lat && place.lon) {
          const placeMarker = L.marker([place.lat, place.lon]).addTo(map)
          .bindPopup(`<strong>${place.tags.name || "Unnamed " + amenity}</strong>`);

          amenityMarkers.push(placeMarker);
        }
      });
  }
  catch(error)
  {
    console.error(error);
  }
}

//Locate the user on the map
function locateMe() {
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(position => {
          const { latitude, longitude } = position.coords;

          // Center map on user location
          map.panTo([latitude, longitude], 14);

          userCoords = [latitude, longitude];

          // Add marker (or move if it already exists)
          if (userMarker)
          {
            userMarker.setLatLng([latitude, longitude]);
          } 
          else 
          {
            userMarker = L.marker([latitude, longitude]).addTo(map)
              .bindPopup("You are here!").openPopup();
          }
        }, () => {
          alert("Unable to retrieve your location.");
        });
      } 
      else 
      {
        alert("Geolocation not supported by this browser.");
      }
}

//Apply the user selected filters
function applyFilter() 
{
  amenity = document.getElementById("filter").value;

  checkAmenities();
}

//Allows the user to search for a location
async function searchLocation() 
{
    const query = document.getElementById("search").value.trim();
    if (!query) return;

    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}`);
      const data = await res.json();

      if (data.length > 0) {
        const { lat, lon } = data[0];
        map.panTo([lat, lon], 14);

        userCoords = [lat, lon];

        // Add a marker at the searched location
        L.marker([lat, lon]).addTo(map)
          .bindPopup(query)
          .openPopup();
      } else {
        alert("Location not found!");
      }
    } catch (err) {
      console.error(err);
      alert("Error fetching location data.");
    }
  }

// Hook search to "Enter" key
document.getElementById("search").addEventListener("keypress", (e) => {
  if (e.key === "Enter") {
    searchLocation();
  }
});

//Setting the value for the distance from location search
const slider = document.getElementById("distanceFromLoc");
const distValue = document.getElementById("distValue");

slider.addEventListener('input', () => {
  distValue.textContent = slider.value;
});