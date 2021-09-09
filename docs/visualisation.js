var apiUri = ""

var nodes, edges, network;

var instructionText = 'Click on nodes to <b>find related entities</b>. CTRL+click to <b>go to Wikipedia</b>. SHIFT+click to <b>collapse nodes</b>.'
var retrievalText = "Retrieving data. Please wait...";
var noMoreDataText = "No more data found...";

function getWikipedia(uri) {
    return uri.replace("http://ab.org/resource/","http://facebook.com/")
}

function randomString(length) {
    return Math.round((Math.pow(36, length + 1) - Math.random() * Math.pow(36, length))).toString(36).slice(1);
}

var HttpClient = function() {
    this.get = function(url, aCallback) {
        var xhr = new XMLHttpRequest();
        xhr.onreadystatechange = function() { 
            if (xhr.readyState == 4 && xhr.status == 200)
                aCallback(JSON.parse(xhr.responseText));
        }

        xhr.open( "GET", url, true );            
        xhr.send( null );
    }
    this.post = function(url, body, aCallback) {
        var xhr = new XMLHttpRequest();
        xhr.onreadystatechange = function() { 
            if (xhr.readyState == 4 && xhr.status == 200)
                aCallback(JSON.parse(xhr.responseText));
        }

        xhr.open( "POST", url, true );            
        xhr.setRequestHeader('Content-type', 'application/json')
        xhr.send( body );
    }
}


function start() {

    var uriEncoded = location.search.split('uri=')[1];

    if (uriEncoded==null) {
        param = "http://ab.org/resource/Martha_Vickers"
    } else {
        param = decodeURI(uriEncoded)
    }

    var client = new HttpClient();

    let names_box = $('#names_box');

    client.get(apiUri + "/subject", function(response) {

          $("#names_box").select2({
              data: response
          });

          names_box.val(param)
          names_box.select2().trigger('change');
          init(param)
    });

}

function instruction() {
    document.getElementById('statement').innerHTML = noMoreDataText ;
    setTimeout(function () { document.getElementById('statement').innerHTML = instructionText }, 1000);
};

function visualise(parent, relation, entity) {
    if (nodes.get(entity._id) == null) {

        var node = {
            id: entity._id,
            uri: entity._id,
            next: 0,
            mass: 2.5
        }

        if (parent != null) {
            node.x = network.getPositions(parent)[parent].x;
            node.y = network.getPositions(parent)[parent].y;
        }


         if (entity._type[0] == "Subject") {
            node.size = 30
            node.type = "subject"
            node.expanded = false
            var description = ""
            if (entity.description != null) {
                description = '<div style="white-space:pre-wrap;">' + entity.description + '</div><br>'
            }
            node.label = entity.label
            node.title = description
        }

        try {
            nodes.add(node);
        }
        catch (err) { console.log("Error when visualising node: " + JSON.stringify(node)) };
    }


        var edge = {}
        if (relation) {
            var vertices = [entity._id, parent];
            vertices.sort();
            edge = {
                id: randomString(20),
                from: vertices[1],
                to: vertices[0],
                label: relation,
                arrows: {
                    from: false,
                    to: true
                },
                color: {
                    color: '#543A71',
                    hover: "#A573DC",
                    highlight: "#A573DC"
                }
            }
        }
        try {
            if (edges.get(edge.id) == null) {
                edges.add(edge);
            }
        }
        catch (err) { console.log("Error when visualising edge: " + JSON.stringify(edge)) };


    for (var property in entity) {

        if (entity[property] != null && typeof entity[property] === 'object' && entity[property].constructor === Object) {
            visualise(entity._id, property, entity[property])
        }

        if (entity[property] != null && typeof entity[property] === 'object' && entity[property].constructor === Array) {

            for (let i = 0; i < entity[property].length; i++) {
                var value = entity[property][i]

                if (value != null && typeof value === 'object' && value.constructor === Object) {
                    visualise(entity._id, property, value)
                }
            }
        }
    }

}

function init(uri) {

    document.getElementById('statement').innerHTML = retrievalText;
    draw();
    var client = new HttpClient();
    var body = JSON.stringify({ query: '{ Subject(filter:{_id: "' + uri + '"}){ _id _type label description thumbnail } }' })
    client.post(apiUri + "/graphql", body, function(response) {
        
        visualise(null, null, response.data.Subject[0]);
        instruction();
    });
};


function getRelated(parent) {
    var parentNode = nodes.get(parent);

    if (parentNode.type == "subject" && !parentNode.expanded) {
        nodes.update({ id: parent, size: 40, expanded: true });

        document.getElementById('statement').innerHTML = retrievalText;
        var query = '{ Subject(filter: { _id:"' + parent + '"}) { _id mouse { _id _type label description thumbnail } } }'

        var client = new HttpClient();
        var body = JSON.stringify({ query: query})
        client.post(apiUri + "/graphql", body, function(response) {
            visualise(null, null, response.data.Subject[0]);
            instruction();
        });
    }

};

function downloadData() {

    var people = []

    for (uri in nodes._data) {
        var item = nodes._data[uri]
        if (item.type === "subject") {
            people.push(item.id)
        }
    }

    // var query = '{ _CONTEXT { _id _type Person Country label description gender thumbnail birthYear deathYear birthCountry deathCountry } Person(filter:{_id: [' + people.map(function (item) {return '"' + item + '"'}) + ']}){ _id _type label description gender thumbnail birthYear deathYear parent { _id } child { _id } spouse { _id } birthCountry { _id } deathCountry { _id } } Country(filter:{_id: [' + countries.map( function (item) {return '"' + item + '"'}) + ']}) { _id _type label } } '
    
    var query = '{ _CONTEXT { _id _type Subject label description thumbnail } Subject(filter:{_id: [' + people.map(function (item) {return '"' + item + '"'}) + ']}){ _id _type label description thumbnail mouse { _id }} } '
    

    var client = new HttpClient();	
    var body = JSON.stringify({ query: query});	
    client.post(apiUri + "/graphql", body, function(response) {	

        let peopleKeys = ["mouse"]
        for (var y in response.data.Subject) { 
            for (var x in peopleKeys) {
                response.data.Subject[y][peopleKeys[x]] = response.data.Subject[y][peopleKeys[x]].filter(function (item) { return people.indexOf(item._id)>-1})
            };
        };
        
        result = {	
            "@context": response.data._CONTEXT,	
            "@id": "@graph",	
            "Subject": response.data.Subject,	
        };

        var dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(result));	
        var dlAnchorElem = document.getElementById('downloadAnchorElem');	
        dlAnchorElem.setAttribute("href", dataStr);	
        dlAnchorElem.setAttribute("download", "data.json");	
        dlAnchorElem.click();	
    });	

}

function draw() {
    nodes = new vis.DataSet([]);
    edges = new vis.DataSet([]);

    var container = document.getElementById('network');

    var data = {
        nodes: nodes,
        edges: edges
    };

    var options = {
        interaction: {
            hover: true,
            hoverConnectedEdges: true,
        },
        "edges": {
            "font": {
                face: 'arial',
                color: '#FFFFFF',
                strokeColor: '#000000'
            },
            "width": 8,
            "length": 20
        },
        "nodes": {
            "font": {
                face: 'arial',
                color: '#FFFFFF'
            },
            "borderWidth": 10,
            "color": {
                background: '#983131',
                border: '#983131',
                highlight: '#E74E4E',
                hover: '#E74E4E'
            }
        },
        "physics": {
            "forceAtlas2Based": {
                "centralGravity": 0.007,
                "springConstant": 0.09,
                "damping": 0.9
            },
            "solver": "forceAtlas2Based",
            "maxVelocity": 10,
            "minVelocity": 3,
            "timestep": 0.4,
        },
        "interaction": { 
            hover: true 
        }
    };

    network = new vis.Network(container, data, options);
    network.fit();

    network.on("click", function (params) {
        if (params.nodes[0] != null) {
            if (params.event.srcEvent.ctrlKey) {
                window.open(getWikipedia(params.nodes[0]));
            } if (params.event.srcEvent.shiftKey) {
                network.selectNodes([params.nodes[0]])
                network.deleteSelected()

            } else {
                getRelated(params.nodes[0]);
            }
        } 
    });
    
    $(document).ready(function(){
        $('#names_box').on('select2:select', function (e) {
            init($('#names_box').val())
          });

          $('#names_box').select2({
            minimumInputLength: 4
          });
    });

    $(document).on('keydown', function (event) {
        if (event.ctrlKey) {
            $('#network').css('cursor', 'pointer');
        }
        if (event.shiftKey) {
            $('#network').css('cursor', 'not-allowed');
        }
    });

    $(document).on('keyup', function (event) {
        $('#network').css('cursor', 'auto');
    });
}