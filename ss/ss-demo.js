// Will this come in handy?
var mode = 'structure';

var maxGraph = {
    name: 'default',
    aList: {},
    aWeights: {},
    aPriors: {},
    p: 1
};

// Make sure alphabetized
var nodes = ['cutting well', 'heavy', 'sharp'];
var thing = 'knives';

for (var i = 0; i < nodes.length; i++) {
    var curr = nodes[i];
    var rest = _.without(nodes, curr);
    maxGraph.aList[curr] = rest;
    maxGraph.aWeights[curr] = [];
    for (var j = 0; j < rest.length; j++) {
        maxGraph.aWeights[curr].push(NaN);
    }
    maxGraph.aPriors[curr] = NaN;
}

var selExpt = -1;
var started = false;

function modifyNames(s) {
    // Super hacky - parse to convert to string, then replace
    return JSON.parse(JSON.stringify(s).replace(
        /\bbright/g, nodes[0]
    ).replace(
        /\bhot/g, nodes[1]
    ).replace(
        /\bon/g, nodes[2]
    ).replace(
        /\blightbulbs/g, thing
    ));
}

$(document).ready(function() {
    $('#models').on('click', 'tr.modeltr', function(e) {
        var i = parseInt(
            e.currentTarget.attributes.modelno.nodeValue
        );
        color(i, 'models');
        updateModel(i);
    });
    $('#expts').on('click', 'tr.expttr', function(e) {
        var i = parseInt(
            e.currentTarget.attributes.exptno.nodeValue
        );
        selExpt = i;
        console.log(expts[selExpt].KLDist.support());
        color(i, 'expts');
    });
    $('#start').click(start);
    $('#update').click(update);
    $('#restart').click(restart);
});

function restart() {
    prior = initialPrior;

    $('#models').html('updating').show();
    $('#expts').html('updating').show();

    console.log("Reparsing and ordering");
    parsePrior();
    console.log("Redisplaying");
    displayAllModels();
    color(0, 'models');
    updateModel(0);
    suggest();
}

function color(i, area) {
    var sel = (area === 'models') ? 'tr.modeltr' : 'tr.expttr';
    var prop = (area === 'models') ? 'modelno' : 'exptno';
    var rows = $(sel);
    for (var n = 0; n < rows.length; n++) {
        var r = rows[n];
        if (r.attributes[prop].value == i) {
            $(r).addClass('success');
        } else {
            $(r).removeClass('success');
        }
    }
}

var aoed;
var prior;
var initialPrior;
var models = [];
var expts = [];
function start() {
    if (started) {
        return;
    }
    started = true;
    aoed = AOED(infrastructure);
    prior = aoed.initialPrior;
    initialPrior = aoed.initialPrior;
    parsePrior();
    displayAllModels();
    // Display the best one
    initSVG();
    // Kick off experiment selection
    suggest();
    // Kick off
    $("#start").hide();
    $("#update").show();
    $("#restart").show();
    $("#response").show();
}

function suggest() {
    exptsUnordered = aoed.suggestAll(prior, {
        usePredictiveY: true,
        returnKL: true,
        verbose: true,
        cache: structureCache
    });
    expts = _.sortBy(exptsUnordered, function(k) {
        return -k.EIG;
    });
    displayAllExpts();
}

function makeY(y) {
    return {y: y, name: y.toString()}
};

function update() {
    $('#models').html('updating').show();
    $('#expts').html('updating').show();
    var res;
    try {
        res = JSON.parse($('#response').val());
    } catch (e) {
        $('#response').val('error');
        throw e;
    }
    var expt = expts[selExpt];
    var updated = aoed.update(prior, expt.x, makeY(res), {cache: structureCache});
    prior = updated.mPosterior;
    $('#aig').text("AIG: " + updated.AIG.toFixed(3));

    console.log("Reparsing and ordering");
    parsePrior();
    console.log("Redisplaying");
    displayAllModels();
    color(0, 'models');
    updateModel(0);
    suggest();
}

function parsePrior() {
    models = [];
    var ordered = _.sortBy(prior.support(), function(k) {
        return -Math.exp(prior.score(k));
    });
    ordered.forEach(function(e) {
        var aArray = JSON.parse(e.name);
        var aList = modifyNames(aArray[0]);
        models.push({
            name: modifyNames(e.name),
            // XXX: CHANGED from booleans: since weights, priors aren't
            // encoded
            aList: aList,
            // Approximate map
            aWeights: _.mapObject(aList, function(k, v) {
                return Array.apply(null, Array(v.length)).map(function() {
                    return NaN;
                });
            }),
            aPriors: maxGraph.aPriors,
            jpd: null,
            p: Math.exp(prior.score(e))
        });
    });
}

function displayAllModels() {
    var modelStr = "<table class='table table-hover'><tr><th>Name</th><th>Prob</th></tr>";
    for (var i = 0; i < models.length; i++) {
        var m = models[i],
            name = m.name,
            aList = m.aList,
            aWeights = m.aWeights,
            aPriors = m.aPriors,
            jpd = m.jpd,
            p = m.p;

        modelStr += (
            '<tr class="modeltr" modelno="' + i + '">' +
            '<td>' + name + '</td>' +
            '<td>' + p.toFixed(3) + '</td>' +
            '</tr>'
        );
    }
    modelStr += "</table>";
    $("#models").html(modelStr);
}

function displayAllExpts() {
    var exptStr = "<table class='table table-hover'><tr><th>Type</th><th>Exp</th><th>EIG</th></tr>";
    for (var i = 0; i < expts.length; i++) {
        var e = expts[i],
            x = e.x,
            EIG = e.EIG,
            KLDist = e.KLDist;

        // XXX: Very hacky. Just override existing bright/hot/etc
        exptStr += (
            '<tr class="expttr" exptno="' + i + '">' +
            '<td>' + x.type + '</td>' +
            '<td>' + modifyNames(x.name) + '</td>' +
            '<td>' + EIG.toFixed(3) + '</td>' +
            '</tr>'
        );
    }
    exptStr += "</table>";
    $("#expts").html(exptStr);
}

function updateModel(modelno) {
    force.stop();
    var lAndN = linksAndNodes(models[modelno]);
    var glinks = lAndN[0],
        gnodes = lAndN[1];
    // Change display of links
    var realLinks = link[0];
    var realLabels = edgelabels[0];

    var linkDict = {};

    for (var i = 0; i < glinks.length; i++) {
        var gl = glinks[i];
        var gs = node[0][gl.source].__data__.name;
        var gt = node[0][gl.target].__data__.name;
        linkDict[JSON.stringify([gs, gt])] = gl.value;
    }

    // Hide all links   
    for (var i = 0; i < realLinks.length; i++) {
        var l = realLinks[i];
        var el = realLabels[i];
        l.style.display = 'none';
        el.style.display = 'none';
    }

    for (var i = 0; i < realLinks.length; i++) {
        var l = realLinks[i];
        var el = realLabels[i];
        var s = l.__data__.source.name;
        var t = l.__data__.target.name;
        var st = JSON.stringify([s, t]);
        if (linkDict.hasOwnProperty(st)) {
            l.style.display = 'block';
            el.style.display = 'block';
            el.childNodes[0].innerHTML = linkDict[st] && linkDict[st].toFixed(1);
        }
    }
    // Also, display JPD somewhere
    if (mode !== 'structure') {
        var jpd = models[modelno].jpd;
        // TODO: These headers are hardcoded
        var jpdStr = "<table class='table table-hover'><tr><th>bright</th><th>hot</th><th>on</th><th>p</th></tr>";
        for (var j = 0; j < jpd.length; j++) {
            var assns = jpd[j][0];
            var p = jpd[j][1];

            jpdStr += (
                '<tr class="jpdtr" jpdno="' + i + '">' +
                '<td>' + assns[0] + '</td>' +
                '<td>' + assns[1] + '</td>' +
                '<td>' + assns[2] + '</td>' +
                '<td>' + p.toFixed(3) + '</td>' +
                '</tr>'
            );
        }
        jpdStr += "</table>";
        $('#jpds').hide();
        $("#jpds").html(jpdStr).show();
    }
}

function linksAndNodes(m) {
    var name = m.name,
        aList = m.aList,
        aWeights = m.aWeights,
        aPriors = m.aPriors,
        p = m.p;

    var gnodes = [];    
    var gnodeNums = {};
    var nodeN = 0;
    for (var key in aList) {
        if (!aList.hasOwnProperty(key)) {
            continue;
        }
        gnodes.push({name: key});
        gnodes.push({name: key + '_b'});

        gnodeNums[key] = nodeN++;
        gnodeNums[key + '_b'] = nodeN++;
    }

    var glinks = [];

    for (var key in aList) { //jshint ignore:line
        if (!aList.hasOwnProperty(key)) {
            continue;
        }
        // Background link
        glinks.push({
            source: gnodeNums[key + '_b'],
            target: gnodeNums[key],
            value: aPriors[key]
        });
        // Other links
        var parents = aList[key];
        for (var i = 0; i < parents.length; i++) { //jshint ignore:line
            var parent = parents[i];
            glinks.push({
                source: gnodeNums[parent],
                target: gnodeNums[key],
                value: aWeights[key][i],
                weight: 1
            });
        }
    }

    return [glinks, gnodes];
}

function initSVG() {
    var lAndN = linksAndNodes(maxGraph);
    var glinks = lAndN[0],
        gnodes = lAndN[1];

    var width = 400,
        height = 400;

    var svg = d3.select("svg")
        .attr("width", width)
        .attr("height", height);

    var force = d3.layout.force()
        .gravity(0.05)
        .distance(100)
        .charge(-400)
        .size([width, height]);

    force
        .nodes(gnodes)
        .links(glinks)
        .start();

    window.force = force;

    var link = svg.selectAll(".link")
        .data(glinks)
        .enter().append("line")
        .attr("class", "link")
        .attr("id", function(d,i) { return d.value; })
        .attr('marker-end','url(#arrowhead)')
        .style("stroke","#ccc")
        .style("pointer-events", "none");

    var edgepaths = svg.selectAll(".edgepath")
        .data(glinks)
        .enter()
        .append('path')
        .attr({'d': function(d) {return 'M '+d.source.x+' '+d.source.y+' L '+ d.target.x +' '+d.target.y; },
               'class':'edgepath',
               'fill-opacity':0,
               'stroke-opacity':0,
               'fill':'blue',
               'stroke':'red',
               'id':function(d,i) {return 'edgepath'+i;}})
        .style("pointer-events", "none");

    var edgelabels = svg.selectAll(".edgelabel")
        .data(glinks)
        .enter()
        .append('text')
        .style("pointer-events", "none")
        .attr({'class':'edgelabel',
               'id': function(d, i) { return 'edgelabel'+i; },
               'dx': 40,
               'dy': 0,
               'font-size': 16,
               'fill': 'blue'});

    edgelabels.append('textPath')
        .attr('xlink:href', function(d,i) { return '#edgepath'+i; })
        .style("pointer-events", "none")
        .text(function(d) { return d.value; });


    svg.append('defs').append('marker')
        .attr({'id':'arrowhead',
               'viewBox':'-0 -5 10 10',
               'refX':25,
               'refY':0,
               //'markerUnits':'strokeWidth',
               'orient':'auto',
               'markerWidth':10,
               'markerHeight':10,
               'xoverflow':'visible'})
        .append('svg:path')
            .attr('d', 'M 0,-5 L 10 ,0 L 0,5')
            .attr('fill', '#ccc')
            .attr('stroke','#ccc');
    var node = svg.selectAll(".node")
        .data(gnodes)
        .enter().append("g")
        .attr("class", "node")
        .call(force.drag);

    node.append("circle")
        .attr("r", 10)
        .style("fill", function (d) { return '#1f77b4'; });

    node.append("text")
        .attr("dx", 12)
        .attr("dy", ".35em")
        .text(function(d) { return d.name; });

    window.node = node;
    window.link = link;
    window.edgepaths = edgepaths;
    window.edgelabels = edgelabels;

    force.on("tick", function() {
        link.attr("x1", function(d) { return d.source.x; })
            .attr("y1", function(d) { return d.source.y; })
            .attr("x2", function(d) { return d.target.x; })
            .attr("y2", function(d) { return d.target.y; });

        node
            .attr("transform", function(d) {
                return "translate(" + d.x + "," + d.y + ")";
            });

        edgepaths.attr('d', function(d) { var path='M '+d.source.x+' '+d.source.y+' L '+ d.target.x +' '+d.target.y;
                                           return path; });

        edgelabels.attr('transform',function(d,i){
            if (d.target.x<d.source.x){
                bbox = this.getBBox();
                rx = bbox.x+bbox.width/2;
                ry = bbox.y+bbox.height/2;
                return 'rotate(180 '+rx+' '+ry+')';
                }
            else {
                return 'rotate(0)';
                }
        });
    });
}
