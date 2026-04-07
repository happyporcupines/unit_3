window.onload = setMap;

function setMap(){
    var width = 760;
    var height = 610;

    d3.select("body")
        .append("h1")
        .attr("class", "pageTitle")
        .text("Economic Connectedness by Zipcode");

    d3.select("body")
        .append("p")
        .attr("class", "pageSubtitle")
        .text("Data from Opportunity Insights");

    var svg = d3.select("body")
        .append("svg")
        .attr("class", "container")
        .attr("width", width)
        .attr("height", height);

    var legendContainer = d3.select("body")
        .append("div")
        .attr("class", "legendContainer");

    var mapLayer = svg.append("g").attr("class", "mapLayer");

    var loadingOverlay = d3.select("body")
        .append("div")
        .attr("class", "loadingOverlay is-visible")
        .attr("aria-live", "polite")
        .html("<div class=\"loadingText\">Rendering map...</div>");

    var loadingText = loadingOverlay.select(".loadingText");
    var loadingDelayId;

    function showLoading(message){
        clearTimeout(loadingDelayId);
        if (message) {
            loadingText.text(message);
        }
        loadingOverlay.classed("is-visible", true);
    }

    function hideLoading(){
        clearTimeout(loadingDelayId);
        loadingOverlay.classed("is-visible", false);
    }

    function scheduleLoading(message, delay){
        clearTimeout(loadingDelayId);
        loadingDelayId = setTimeout(function(){
            showLoading(message);
        }, delay);
    }

    var tooltip = d3.select("body")
        .append("div")
        .attr("class", "tooltip")
        .style("opacity", 0);

    var promises = [
        d3.json("data/social_capital_zip.topojson")
    ];

    Promise.all(promises).then(callback).catch(function(error){
        showLoading("Failed to load map data.");
        legendContainer.html("")
            .append("div")
            .attr("class", "loadError")
            .text("Map data could not be loaded on this page load. Please refresh and try again.");
        console.error("Failed to load datasets:", error);
    });

    function callback(data){
        requestAnimationFrame(function(){
            requestAnimationFrame(function(){
                renderMap(data);
            });
        });
    }

    function renderMap(data){
        var socialCapitalTopo = data[0];
        var csvData = [];
        var ecBins = [
            {
                label: "Very Low",
                rangeText: "0.00 - 0.50",
                max: 0.50,
                color: "#fff7bc",
                message: "The Silos: These neighborhoods are largely \"keeping to their own,\" with very few friendships crossing income lines."
            },
            {
                label: "Low",
                rangeText: "0.51 - 0.80",
                max: 0.80,
                color: "#c7e9b4",
                message: "The Climbing Phase: There is some movement here, but class barriers are still pretty sturdy."
            },
            {
                label: "Average",
                rangeText: "0.81 - 1.00",
                max: 1.00,
                color: "#7fcdbb",
                message: "The Common Ground: These areas are approaching the point where your bank account doesn't dictate your social circle."
            },
            {
                label: "High",
                rangeText: "1.01 - 1.30",
                max: 1.30,
                color: "#41b6c4",
                message: "The Bridge Builders: Like Sauk Centre, these places are actively \"mixing it up\" more than average."
            },
            {
                label: "Exceptional",
                rangeText: "1.31 - 1.71",
                max: 1.71,
                color: "#225ea8",
                message: "Social Superstars: These rare pockets have extraordinary levels of class-crossing connection."
            }
        ];

        function getEconomicConnectednessBin(score){
            for (var i = 0; i < ecBins.length; i++) {
                if (score <= ecBins[i].max) {
                    return ecBins[i];
                }
            }
            return ecBins[ecBins.length - 1];
        }

        var zipFeatures = topojson.feature(
            socialCapitalTopo,
            socialCapitalTopo.objects.zipcodes
        ).features;

        var csvByZip = new Map(csvData.map(function(d){
            return [String(d.zip), d.place];
        }));

        zipFeatures.forEach(function(feature){
            var zipCode = String(feature.properties.zip);
            feature.properties.place = csvByZip.get(zipCode) || "Unknown place";
        });

        var color = d3.scaleThreshold()
            .domain([0.51, 0.81, 1.01, 1.31])
            .range(ecBins.map(function(bin){
                return bin.color;
            }));

        var projection = d3.geoAlbers();
        projection.fitExtent(
            [[8, 8], [width - 8, height - 8]],
            { type: "FeatureCollection", features: zipFeatures }
        );

        var path = d3.geoPath().projection(projection);

        mapLayer.selectAll(".zip")
            .data(zipFeatures)
            .enter()
            .append("path")
            .attr("class", "zip")
            .attr("d", path)
            .style("fill", function(d){
                return color(+d.properties.ec_zip);
            })
            .style("stroke", "#f7f7f7")
            .style("stroke-width", "0.2px")
            .on("mouseenter", function(event, d){
                var ecScore = +d.properties.ec_zip;
                var volunteerismRate = +d.properties.volunteering_rate_zip;
                var levelInfo = getEconomicConnectednessBin(ecScore);

                d3.select(this).style("stroke", "#222").style("stroke-width", "0.6px");
                tooltip
                    .style("opacity", 1)
                    .html(
                        "<div class=\"tooltipTitle\">ZIP " + d.properties.postcode + "</div>" +
                        "<div>Economic Connectedness: " + ecScore.toFixed(2) + "</div>" +
                        "<div>Vollenteerism: " + (volunteerismRate * 100).toFixed(2) + "% of population</div>" +
                        "<div class=\"tooltipSectionTitle\">What this economic connectedness score means:</div>" +
                        "<div><strong>" + levelInfo.label + "</strong></div>" +
                        "<div>" + levelInfo.message + "</div>"
                    );
            })
            .on("mousemove", function(event){
                tooltip
                    .style("left", (event.pageX + 14) + "px")
                    .style("top", (event.pageY - 18) + "px");
            })
            .on("mouseleave", function(){
                d3.select(this).style("stroke", "#f7f7f7").style("stroke-width", "0.2px");
                tooltip.style("opacity", 0);
            });

        var currentScale = 1;

        var zoom = d3.zoom()
            .scaleExtent([1, 8])
            .filter(function(event){
                if (event.type === "wheel") return true;
                if (event.type === "mousedown" || event.type === "touchstart") {
                    return currentScale > 1;
                }
                return !event.ctrlKey;
            })
            .on("start", function(){
                scheduleLoading("Updating view...", 120);
            })
            .on("zoom", function(event){
                currentScale = event.transform.k;
                if (event.transform.k <= 1) {
                    mapLayer.attr("transform", d3.zoomIdentity);
                    return;
                }
                mapLayer.attr("transform", event.transform);
            })
            .on("end", function(){
                requestAnimationFrame(function(){
                    requestAnimationFrame(function(){
                        hideLoading();
                    });
                });
            });

        svg.call(zoom);

        svg.append("text")
            .attr("class", "chartNote")
            .attr("x", 15)
            .attr("y", height - 15)
            .text("Loaded " + csvData.length + " CSV rows and " + zipFeatures.length + " ZIP polygons.");

        legendContainer.html("");
        legendContainer.append("div")
            .attr("class", "legendHeader")
            .text("Legend");

        var legendWidth = 520;
        var legendHeight = 18;
        var segmentWidth = legendWidth / ecBins.length;
        var legendSvg = legendContainer.append("svg")
            .attr("class", "legend")
            .attr("width", legendWidth)
            .attr("height", 92);

        legendSvg.selectAll(".legendSegment")
            .data(ecBins)
            .enter()
            .append("rect")
            .attr("class", "legendSegment")
            .attr("x", function(d, i){
                return i * segmentWidth;
            })
            .attr("y", 8)
            .attr("width", segmentWidth)
            .attr("height", legendHeight)
            .attr("fill", function(d){
                return d.color;
            })
            .attr("stroke", "#d7d1c2")
            .attr("stroke-width", 1);

        legendSvg.selectAll(".legendLevelText")
            .data(ecBins)
            .enter()
            .append("text")
            .attr("class", "legendLevelText")
            .attr("x", function(d, i){
                return i * segmentWidth + segmentWidth / 2;
            })
            .attr("y", 46)
            .attr("text-anchor", "middle")
            .text(function(d){
                return d.label;
            });

        legendSvg.selectAll(".legendRangeText")
            .data(ecBins)
            .enter()
            .append("text")
            .attr("class", "legendRangeText")
            .attr("x", function(d, i){
                return i * segmentWidth + segmentWidth / 2;
            })
            .attr("y", 66)
            .attr("text-anchor", "middle")
            .text(function(d){
                return d.rangeText;
            });

        requestAnimationFrame(function(){
            requestAnimationFrame(function(){
                hideLoading();
            });
        });
    }
};

