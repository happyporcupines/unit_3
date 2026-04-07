(function(){
    // =============================================
    // ATTRIBUTES AND EXPRESSED VARIABLES
    // =============================================
    var width = 700;
    var height = 520;
    var csvData = [];
    var ecBins = [
        {
            label: "No Data",
            rangeText: "N/A",
            isNoData: true,
            color: "#bdbdbd",
            message: "Data not available for this area."
        },
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

    // Page elements
    var mapShell, svg, mapLayer, legendContainer, tooltip, loadingOverlay, loadingText;
    var loadingDelayId;

    // =============================================
    // UTILITY FUNCTIONS
    // =============================================
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

    function getEconomicConnectednessBin(score){
        // Handle null, undefined, empty string, or NaN values
        if (score === null || score === undefined || score === "" || isNaN(score)) {
            return ecBins[0];  // Return the "No Data" bin
        }
        for (var i = 1; i < ecBins.length; i++) {  // Start from 1 to skip "No Data" bin
            if (score <= ecBins[i].max) {
                return ecBins[i];
            }
        }
        return ecBins[ecBins.length - 1];
    }

    // =============================================
    // DOM SETUP FUNCTION
    // =============================================
    function createPageElements(){
        d3.select("body")
            .append("h1")
            .attr("class", "pageTitle")
            .text("Economic Connectedness by Zipcode");

        d3.select("body")
            .append("p")
            .attr("class", "pageSubtitle")
            .text("Data from Opportunity Insights");

        mapShell = d3.select("body")
            .append("div")
            .attr("class", "mapShell")
            .style("position", "relative")
            .style("display", "block")
            .style("overflow", "hidden")
            .style("width", width + "px")
            .style("height", height + "px");

        svg = mapShell
            .append("svg")
            .attr("class", "container")
            .attr("width", width)
            .attr("height", height);

        legendContainer = d3.select("body")
            .append("div")
            .attr("class", "legendContainer");

        mapLayer = svg.append("g").attr("class", "mapLayer");

        loadingOverlay = mapShell
            .append("div")
            .attr("class", "loadingOverlay is-visible")
            .attr("aria-live", "polite")
            .style("position", "absolute")
            .style("left", "0")
            .style("top", "0")
            .style("width", width + "px")
            .style("height", height + "px")
            .style("inset", "0")
            .style("display", "grid")
            .style("place-items", "center")
            .html("<div class=\"loadingText\">Rendering map...</div>");

        loadingText = loadingOverlay.select(".loadingText");

        tooltip = d3.select("body")
            .append("div")
            .attr("class", "tooltip")
            .style("opacity", 0);
    }

    // =============================================
    // MAP RENDERING FUNCTIONS
    // =============================================
    function processFeatures(socialCapitalTopo){
        var zipFeatures = topojson.feature(
            socialCapitalTopo,
            socialCapitalTopo.objects.zipcodes
        ).features;

        var loadedStateCodes = Array.from(new Set(zipFeatures.map(function(feature){
            var county = String(feature.properties.county || "").padStart(5, "0");
            return county.slice(0, 2);
        }))).sort();

        var csvByZip = new Map(csvData.map(function(d){
            return [String(d.zip), d.place];
        }));

        zipFeatures.forEach(function(feature){
            var zipCode = String(feature.properties.zip);
            feature.properties.place = csvByZip.get(zipCode) || "Unknown place";
        });

        return { features: zipFeatures, stateCodes: loadedStateCodes };
    }

    function createColorScale(){
        return d3.scaleThreshold()
            .domain([0.51, 0.81, 1.01, 1.31])
            .range(ecBins.map(function(bin){
                return bin.color;
            }));
    }

    function drawMap(zipFeatures, color, projection, path){
        mapLayer.selectAll(".zip")
            .data(zipFeatures)
            .enter()
            .append("path")
            .attr("class", "zip")
            .attr("d", path)
            .style("fill", function(d){
                var ecValue = d.properties.ec_zip;
                if (ecValue === null || ecValue === undefined || ecValue === "") {
                    return "#bdbdbd";  // neutral gray for missing data
                }
                return color(+ecValue);
            })
            .style("stroke", "#f7f7f7")
            .style("stroke-width", "0.2px")
            .on("mouseenter", onZipMouseEnter)
            .on("mousemove", onZipMouseMove)
            .on("mouseleave", onZipMouseLeave);
    }

    function onZipMouseEnter(event, d){
        var ecValue = d.properties.ec_zip;
        var ecScore = +ecValue;
        var volunteerismRate = +d.properties.volunteering_rate_zip;
        var levelInfo = getEconomicConnectednessBin(ecScore);
        
        var ecScoreDisplay = (ecValue === null || ecValue === undefined || ecValue === "" || isNaN(ecScore)) 
            ? "N/A" 
            : ecScore.toFixed(2);
        var volunteerismDisplay = (isNaN(volunteerismRate)) 
            ? "N/A" 
            : (volunteerismRate * 100).toFixed(2) + "%";

        d3.select(this).style("stroke", "#222").style("stroke-width", "0.6px");
        tooltip
            .style("opacity", 1)
            .html(
                "<div class=\"tooltipTitle\">ZIP " + d.properties.postcode + "</div>" +
                "<div>Economic Connectedness: " + ecScoreDisplay + "</div>" +
                "<div>Volunteersim: " + volunteerismDisplay + " of population</div>" +
                "<div class=\"tooltipSectionTitle\">What this economic connectedness score means:</div>" +
                "<div><strong>" + levelInfo.label + "</strong></div>" +
                "<div>" + levelInfo.message + "</div>"
            );
    }

    function onZipMouseMove(event){
        tooltip
            .style("left", (event.pageX + 14) + "px")
            .style("top", (event.pageY - 18) + "px");
    }

    function onZipMouseLeave(){
        d3.select(this).style("stroke", "#f7f7f7").style("stroke-width", "0.2px");
        tooltip.style("opacity", 0);
    }

    function setupZoom(){
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
    }

    function createLegend(){
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
    }

    function addChartNote(zipFeatures, loadedStateCodes){
        svg.append("text")
            .attr("class", "chartNote")
            .attr("x", 15)
            .attr("y", height - 15)
            .text("Loaded " + csvData.length + " CSV rows, " + zipFeatures.length + " ZIP polygons, states: " + loadedStateCodes.join(",") + ".");
    }

    // =============================================
    // BAR CHART FUNCTION
    // =============================================
    function createBarChart(zipFeatures, colorScale){
        // Chart frame dimensions
        var chartWidth = window.innerWidth * 0.9,
            chartHeight = 500,
            leftPadding = 60,
            rightPadding = 20,
            topBottomPadding = 40,
            chartInnerWidth = chartWidth - leftPadding - rightPadding,
            chartInnerHeight = chartHeight - topBottomPadding * 2,
            translate = "translate(" + leftPadding + "," + topBottomPadding + ")";

        // Create a new svg element for the bar chart
        var chartContainer = d3.select("body")
            .append("div")
            .attr("class", "barChartContainer")
            .style("margin-top", "30px")
            .style("overflow-x", "auto")
            .style("background", "#fffdf8")
            .style("padding", "20px");

        var chart = chartContainer.append("svg")
            .attr("width", chartWidth)
            .attr("height", chartHeight)
            .attr("class", "barChart");

        // Create a rectangle for chart background fill
        var chartBackground = chart.append("rect")
            .attr("class", "chartBackground")
            .attr("width", chartInnerWidth)
            .attr("height", chartInnerHeight)
            .attr("transform", translate)
            .style("fill", "#f9f9f9")
            .style("stroke", "#e0e0e0")
            .style("stroke-width", 1);

        // Filter out features with no data
        var dataWithValues = zipFeatures.filter(function(d){
            return d.properties.ec_zip !== null && 
                   d.properties.ec_zip !== undefined && 
                   d.properties.ec_zip !== "";
        }).sort(function(a, b){
            return parseFloat(b.properties.ec_zip) - parseFloat(a.properties.ec_zip);
        });

        // Create a scale to size bars proportionally to frame and for axis
        var maxValue = d3.max(dataWithValues, function(d){
            return parseFloat(d.properties.ec_zip);
        });

        var yScale = d3.scaleLinear()
            .range([chartInnerHeight, 0])
            .domain([0, maxValue * 1.1]);

        var xScale = d3.scaleBand()
            .range([0, chartInnerWidth])
            .domain(dataWithValues.map(function(d, i){ return i; }))
            .padding(0.1);

        // Set bars for each zipcode
        var bars = chart.selectAll(".bar")
            .data(dataWithValues)
            .enter()
            .append("rect")
            .attr("class", function(d){
                return "bar zip-" + d.properties.zip;
            })
            .attr("width", xScale.bandwidth())
            .attr("x", function(d, i){
                return xScale(i) + leftPadding;
            })
            .attr("height", function(d){
                return chartInnerHeight - yScale(parseFloat(d.properties.ec_zip));
            })
            .attr("y", function(d){
                return yScale(parseFloat(d.properties.ec_zip)) + topBottomPadding;
            })
            .style("fill", function(d){
                return colorScale(parseFloat(d.properties.ec_zip));
            })
            .style("stroke", "#f7f7f7")
            .style("stroke-width", "0.5px");

        // Add interactivity to bars
        bars.on("mouseenter", function(event, d){
                var ecScore = parseFloat(d.properties.ec_zip);
                var levelInfo = getEconomicConnectednessBin(ecScore);
                
                d3.select(this).style("stroke", "#222").style("stroke-width", "1.5px");
                tooltip
                    .style("opacity", 1)
                    .html(
                        "<div class=\"tooltipTitle\">ZIP " + d.properties.postcode + "</div>" +
                        "<div>Economic Connectedness: " + ecScore.toFixed(2) + "</div>" +
                        "<div class=\"tooltipSectionTitle\">Classification:</div>" +
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
                d3.select(this).style("stroke", "#f7f7f7").style("stroke-width", "0.5px");
                tooltip.style("opacity", 0);
            });

        // Create a text element for the chart title
        var chartTitle = chart.append("text")
            .attr("x", chartWidth / 2)
            .attr("y", 25)
            .attr("class", "chartTitle")
            .attr("text-anchor", "middle")
            .style("font-size", "1.3em")
            .style("font-weight", "600")
            .style("fill", "#1f1f1f")
            .text("Economic Connectedness Score by Zipcode");

        // Create vertical axis generator
        var yAxis = d3.axisLeft()
            .scale(yScale)
            .ticks(5);

        // Place axis
        var axis = chart.append("g")
            .attr("class", "axis")
            .attr("transform", translate)
            .call(yAxis);

        // Add axis label
        chart.append("text")
            .attr("class", "axisLabel")
            .attr("transform", "rotate(-90)")
            .attr("y", 15)
            .attr("x", 0 - (chartHeight / 2))
            .attr("text-anchor", "middle")
            .style("font-size", "0.95em")
            .text("Economic Connectedness Score");

        // Create frame for chart border
        var chartFrame = chart.append("rect")
            .attr("class", "chartFrame")
            .attr("width", chartInnerWidth)
            .attr("height", chartInnerHeight)
            .attr("transform", translate)
            .style("fill", "none")
            .style("stroke", "#999")
            .style("stroke-width", 1.5);

        // Add chart note
        chart.append("text")
            .attr("class", "chartNote")
            .attr("x", 15)
            .attr("y", chartHeight - 10)
            .style("font-size", "0.85em")
            .text("Showing " + dataWithValues.length + " zipcodes with available data. Sorted by economic connectedness score (highest to lowest).");
    }

    // =============================================
    // MAIN RENDERING FUNCTION
    // =============================================
    function renderMap(data){
        var socialCapitalTopo = data[0];
        var processedData = processFeatures(socialCapitalTopo);
        var zipFeatures = processedData.features;
        var loadedStateCodes = processedData.stateCodes;

        var color = createColorScale();

        var projection = d3.geoAlbers();
        projection.fitExtent(
            [[4, 4], [width - 4, height - 4]],
            { type: "FeatureCollection", features: zipFeatures }
        );

        var path = d3.geoPath().projection(projection);

        drawMap(zipFeatures, color, projection, path);
        setupZoom();
        addChartNote(zipFeatures, loadedStateCodes);
        createLegend();
        createBarChart(zipFeatures, color);

        requestAnimationFrame(function(){
            requestAnimationFrame(function(){
                hideLoading();
            });
        });
    }

    // =============================================
    // ENTRY POINT
    // =============================================
    function setMap(){
        createPageElements();

        var promises = [
            d3.json("data/social_capital_zip.topojson")
        ];

        Promise.all(promises).then(function(data){
            requestAnimationFrame(function(){
                requestAnimationFrame(function(){
                    renderMap(data);
                });
            });
        }).catch(function(error){
            showLoading("Failed to load map data.");
            legendContainer.html("")
                .append("div")
                .attr("class", "loadError")
                .text("Map data could not be loaded on this page load. Please refresh and try again.");
            console.error("Failed to load datasets:", error);
        });
    }

    // Initialize when page loads
    window.onload = setMap;
})();

