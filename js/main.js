window.onload = function(){
    var width = 960;
    var height = 650;
    var margin = {
        top: 70,
        right: 230,
        bottom: 120,
        left: 90
    };

    var svg = d3.select("body")
        .append("svg")
        .attr("class", "container")
        .attr("width", width)
        .attr("height", height);

    var tooltip = d3.select("body")
        .append("div")
        .attr("class", "tooltip")
        .style("opacity", 0);

    d3.json("data/MegaCities.geojson").then(function(data){
        var cityData = data.features.map(function(feature){
            var properties = feature.properties;
            var pop1985 = properties.Pop_1985;
            var pop2015 = properties.Pop_2015;

            return {
                city: properties.City,
                pop1985: pop1985,
                pop2015: pop2015,
                difference: pop2015 - pop1985
            };
        });

        var xExtent = d3.extent(cityData, function(d){
            return d.pop1985;
        });

        var yExtent = d3.extent(cityData, function(d){
            return d.pop2015;
        });

        var differenceExtent = d3.extent(cityData, function(d){
            return d.difference;
        });

        var x = d3.scaleLinear()
            .range([margin.left, width - margin.right])
            .domain([Math.max(0, xExtent[0] - 1), xExtent[1] + 2])
            .nice();

        var y = d3.scaleLinear()
            .range([height - margin.bottom, margin.top])
            .domain([Math.max(0, yExtent[0] - 1), yExtent[1] + 2])
            .nice();

        var radius = d3.scaleSqrt()
            .range([8, 40])
            .domain(differenceExtent);

        var color = d3.scaleLinear()
            .range(["#a8ddb5", "#1f78b4"])
            .domain(differenceExtent);

        var xAxis = d3.axisBottom(x);
        var yAxis = d3.axisLeft(y);
        var formatMillions = d3.format(".2f");

        svg.append("g")
            .attr("class", "axis")
            .attr("transform", "translate(0," + (height - margin.bottom) + ")")
            .call(xAxis);

        svg.append("g")
            .attr("class", "axis")
            .attr("transform", "translate(" + margin.left + ",0)")
            .call(yAxis);

        svg.append("text")
            .attr("class", "title")
            .attr("text-anchor", "middle")
            .attr("x", width / 2)
            .attr("y", 35)
            .text("Difference in Megacities Population between 1985 and 2015.");

        svg.append("text")
            .attr("class", "axisLabel")
            .attr("text-anchor", "middle")
            .attr("x", (width - margin.right + margin.left) / 2)
            .attr("y", height - 50)
            .text("Population in 1985 (millions)");

        svg.append("text")
            .attr("class", "axisLabel")
            .attr("text-anchor", "middle")
            .attr("transform", "translate(25," + ((height - margin.bottom + margin.top) / 2) + ") rotate(-90)")
            .text("Population in 2015 (millions)");

        svg.append("text")
            .attr("class", "chartNote")
            .attr("x", margin.left)
            .attr("y", height - 18)
            .text("Hover over a bubble to get city information.");

        var bubbles = svg.selectAll(".circles")
            .data(cityData)
            .enter()
            .append("circle")
            .attr("class", "circles")
            .attr("id", function(d){
                return d.city;
            })
            .attr("r", function(d){
                return radius(d.difference);
            })
            .attr("cx", function(d){
                return x(d.pop1985);
            })
            .attr("cy", function(d){
                return y(d.pop2015);
            })
            .style("fill", function(d){
                return color(d.difference);
            })
            .style("fill-opacity", 0.7)
            .style("stroke", "#1f1f1f")
            .style("stroke-width", "1px")
            .on("mouseenter", function(event, d){
                d3.select(this)
                    .style("stroke-width", "2px")
                    .style("fill-opacity", 0.9);

                tooltip
                    .style("opacity", 1)
                    .html("<div class=\"tooltipTitle\">" + d.city + "</div><div>Change: " + formatMillions(d.difference) + " million</div>");
            })
            .on("mousemove", function(event){
                tooltip
                    .style("left", (event.pageX + 14) + "px")
                    .style("top", (event.pageY - 18) + "px");
            })
            .on("mouseleave", function(){
                d3.select(this)
                    .style("stroke-width", "1px")
                    .style("fill-opacity", 0.7);

                tooltip.style("opacity", 0);
            });
    }).catch(function(error){
        console.error("Failed to load megacity data:", error);
    });
};

