from django.contrib.auth.decorators import login_required
from django.contrib.gis.geos import Point
from django.http import JsonResponse
from shapely.geometry import Polygon
import overpy
import json


@login_required
def update_database(request):
    my_location = request.POST.get("point", None)  # store the data in the incoming request
    if not my_location:
        return JsonResponse({"message": "No location found."}, status=400)

    try:
        my_coords = [float(coord) for coord in my_location.split(", ")]
        my_profile = request.user.profile   # get user profile
        my_profile.last_location = Point(my_coords)
        my_profile.save()  # save the location in the database

        message = f"Updated {request.user.username} with {f'POINT({my_location})'}"

        # return success message
        return JsonResponse({"message": message}, status=200)
    except:
        return JsonResponse({"message": "No profile found."}, status=400)


# this function arrange user inputs to build the 'query'(in overpass QL language) for schools,college,university and
# returns the query
def query_overpass(request):
    data_received = request.POST.get("point", None)
    data_split = [str(coord) for coord in data_received.split(", ")]
    api = overpy.Overpass()
    try:
        # ajax query
        prefix = """[out:json][timeout:50];("""
        node = 'node["amenity"="' + data_split[2] + '"](around:'   # add the search key word
        suffix = """);out body;>;out skel qt;"""
        q = str(4000) + ',' + data_split[1] + ',' + data_split[0]   # search radius and user location long and lat
        built_query = prefix + node + q + ');' + suffix
        result = api.query(built_query)     # process overpass query

        # set geoJSON dict structure
        geojson_result = {
            "type": "FeatureCollection",
            "features": [],
        }

        # This next section iterates through each 'way' and gets its centroid. It also keeps a record of the
        # points in the so that they are not duplicated when we process the 'nodes'
        nodes_in_way = []

        for way in result.ways:
            geojson_feature = None
            geojson_feature = {
                "type": "Feature",
                "id": "",
                "geometry": "",
                "properties": {}
            }
            poly = []
            for node in way.nodes:
                # Record the nodes and make the polygon
                nodes_in_way.append(node.id)
                poly.append([float(node.lon), float(node.lat)])
            poly = Polygon(poly)
            geojson_feature["id"] = f"way_{way.id}"
            geojson_feature["geometry"] = json.loads(poly.centroid.geojson)
            geojson_feature["properties"] = {}
            for k, v in way.tags.items():
                geojson_feature["properties"][k] = v

            geojson_result["features"].append(geojson_feature)

        # Process results that are 'nodes'
        for node in result.nodes:
            # Ignore nodes which are also in a 'way' as we will have already processed the 'way'.
            if node.id in nodes_in_way:
                continue
            geojson_feature = None
            geojson_feature = {
                "type": "Feature",
                "id": "",
                "geometry": "",
                "properties": {}
            }
            point = Point([float(node.lon), float(node.lat)])
            geojson_feature["id"] = f"node_{node.id}"
            geojson_feature["geometry"] = json.loads(point.geojson)
            geojson_feature["properties"] = {}
            for k, v in node.tags.items():
                geojson_feature["properties"][k] = v

            geojson_result["features"].append(geojson_feature)

        # Return the complete GeoJSON structure.
        return JsonResponse({"message": geojson_result}, status=200)
    except:
        # Return error message
        return JsonResponse({"message": "Unidentified search word"}, status=400)
