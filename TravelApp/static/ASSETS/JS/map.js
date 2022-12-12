var HOST = location.protocol + "//" + location.host;
var locationMarker;
var circle;
var poi_markers;
var current_loc;
var map_ins;
//create and icon to display the search results
var LeafIcon = L.Icon.extend({
    options: {
       iconSize:     [38, 95],
       shadowSize:   [50, 64],
       iconAnchor:   [22, 94],
       shadowAnchor: [4, 62],
       popupAnchor:  [-3, -76]
    }
});
var greenIcon = new LeafIcon({
    iconUrl: 'http://leafletjs.com/examples/custom-icons/leaf-green.png',
    shadowUrl: 'http://leafletjs.com/examples/custom-icons/leaf-shadow.png'
})

$("#map").css({
    "width": "100%",
    "height": $(document).height() - ($ ("#header").height() + $("#footer").height() + 45)
});


function map_init_basic(map, options) {
    var pos;
    map.setView([53.5, -8.5], 11);
    updateLocation(map);
    map.on('touchstart click dblclick ', function () {
        updateLocation(map);
    });
}

// call necessary functions to update user location and display the user location on the map
function updateLocation(map) {
    navigator.geolocation.getCurrentPosition(
        function (pos) {
            setMapToCurrentLocation(map, pos);
            update_db(pos);
            current_loc = pos;
            map_ins = map;
        },
        function (err) {
        },
        {
            enableHighAccuracy: true,
            timeout: 30000
        }
    );
}

// display the current location on the map
function setMapToCurrentLocation(map, pos) {
    console.log("In setMapToCurrentLocation.");
    var myLatLon = L.latLng(pos.coords.latitude, pos.coords.longitude);
    map.flyTo(myLatLon, 16); // added animation
    if (locationMarker) {
        map.removeLayer(locationMarker); // remove any previously added marker
    }
    locationMarker = L.marker(myLatLon).addTo(map); // add the new marker to the application

    if (circle) {
        map.removeLayer(circle); //remove circle if already present
    }

    // add the circle around the current location
    circle = L.circle(myLatLon, {
        color: 'blue',
        fillColor: 'blue',
        fillOpacity: 0.3,
        radius: 40
    }).addTo(map);
    $(".toast-body").html("Found location<br>Lat: " + myLatLon.lat + " Lon: " + myLatLon.lng);
    $(".toast").toast('show');
}

// update database with the user's current location
function update_db(pos) {
    var locString = pos.coords.longitude + ", " + pos.coords.latitude;

    // ajax request to the backend update the database
    $.ajax({
        type: "POST",
        headers: {
            'X-CSRFToken': getCookie('csrftoken')
        },
        url: HOST + "/updatedb/",
        data: {
            point: locString
        }
    }).done(function (data, status, xhr) {
        console.log(data["message"])
        var originalMsg = $(".toast-body").html();
        $(".toast-body").html(originalMsg + "<br/>Updateddatabase<br/>" + data["message"]);
    }).fail(function (xhr, status, error) {
        console.log(error);
        var originalMsg = $(".toast-body").html();
        $(".toast-body").html(originalMsg + "<br/>" + error);
    }).always(function () {
        console.log("find_loc_ed finished");
        $(".toast").toast('show');
    });
}

// get session for user authentication
function getCookie(cname) {
     let name = cname + "=";
     let ca = document.cookie.split(';');
     for(let i=0; i<ca.length; i++) {
        let c = ca[i];
        while (c.charAt(0)===' ') c = c.substring(1);
        if(c.indexOf(name) === 0)
           return c.substring(name.length,c.length);
     }
     return "";
}

// function to make a call to django back-end to query overpass and get geoJSON data back
// display the results on the map
function showOnMap(search_keyword) {
    var locString = current_loc.coords.longitude + ", " + current_loc.coords.latitude + ", " + search_keyword;
    // remove marker if already present
    if (poi_markers) {
        map_ins.removeLayer(poi_markers);
    }
    map_ins.options.maxZoom = 20;

    // ajax request to send location and search data to the back-end and
    // use the geoJSON response to display the returned data on the map

    $.ajax({
        type: "POST",
        headers: {
            'X-CSRFToken': getCookie('csrftoken')
        },
        url: HOST + "/query_overpass/",
        data: {
            point: locString
        }
    }).done(function (data, status, xhr) {
        //Create a cluster group for our markers to avoid clutter. 'Marker Cluster' is a Leaflet plugin.
        console.log(data);
        poi_markers = L.markerClusterGroup();

        data = data.message;

        // Handle GeoJSON response from the server.
        var geoJsonLayer = L.geoJson(data, {
            pointToLayer: function (feature, latlng) {
                // Associate each point with the icon we made earlier
                return L.marker(latlng, {icon: greenIcon});
            },
            onEachFeature: function (feature, layer) {
                // For each feature associate a popup with the 'name' property
                layer.bindPopup(feature.properties.name);
            }
        });

    // Add the GeoJSON layer to the cluster.
    poi_markers.addLayer(geoJsonLayer);

    // Add the cluster to the map.
    map_ins.addLayer(poi_markers);
    }).fail(function (xhr, status, error) {
        var originalMsg = $(".toast-body").html();
        $(".toast-body").html(originalMsg + "<br/>" + error);
    }).always(function () {
        // toggleCentredSpinner("hide");
    });
}