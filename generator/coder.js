class SVGPathGenerator {
    /**
     * Constructor. Options are now less critical as JSON defines properties,
     * but can still be used for defaults if not in JSON (less recommended).
     *
     *  - `defaultCornerRadius`: Default radius if not specified in points (default: 0).
     *  - `closePath`:  Default closePath behavior (default: false).
     *  - `xKey`:  Key for x coordinate (default: 'x').
     *  - `yKey`: Key for y coordinate (default: 'y').
     *
     * @param {object} options
     */
    constructor(options = {}) {
        this.defaultCornerRadius = options.cornerRadius || 0;
        this.closePath = options.closePath || false;
        this.xKey = options.xKey || 'x';
        this.yKey = options.yKey || 'y';
        // Stroke and fill defaults are less relevant now, as JSON is primary
        this.defaultStroke = options.stroke || 'none';
        this.defaultFill = options.fill || 'none';
    }


    /**
     * Creates a rounded SVG path 'd' attribute string from an array of coordinates.
     *  Now uses Cubic Bezier curves (C/c commands) for corners.
     * @param {Array<{x: number, y: number, cornerRadius?: number}>} coords Array of coordinates.
     *        Each coordinate can optionally have a `cornerRadius`.
     * @param {number} defaultRadius The default corner radius to use if a point doesn't specify one.
     * @param {boolean} close Whether to close the path (Z command).
     * @returns {string} The SVG path 'd' attribute string.
     */
    createRoundedPath(coords, defaultRadius, close) {
        if (!coords || coords.length === 0) {
            return "";
        }

        let path = "";
        const len = coords.length;

        for (let i = 0; i < len; i++) {
            const current = coords[i];
            const prev = coords[(i - 1 + len) % len]; // Wrap around for previous point
            const next = coords[(i + 1) % len];       // Wrap around for next point

            let radius = current.cornerRadius !== undefined ? current.cornerRadius : defaultRadius;
            radius = Math.max(0, radius); // Ensure radius is not negative

            if (i === 0) {
                path += `M ${current.x},${current.y} `;
            } else {
                // Calculate control points for the curve
                const prevDx = current.x - prev.x;
                const prevDy = current.y - prev.y;
                const nextDx = next.x - current.x;
                const nextDy = next.y - current.y;

                const prevDist = Math.sqrt(prevDx * prevDx + prevDy * prevDy);
                const nextDist = Math.sqrt(nextDx * nextDx + nextDy * nextDy);

                // Handle cases where distances are zero (points are coincident)
                const prevDistNonZero = prevDist === 0 ? 1 : prevDist;  // Avoid division by zero
                const nextDistNonZero = nextDist === 0 ? 1 : nextDist;

                const actualRadius = Math.min(radius, prevDist / 2, nextDist / 2);

                //If distances are 0, do not apply radius
                const control1X = prevDist === 0 ? current.x : current.x - (prevDx / prevDistNonZero) * actualRadius;
                const control1Y = prevDist === 0 ? current.y : current.y - (prevDy / prevDistNonZero) * actualRadius;
                const control2X = nextDist === 0 ? current.x : current.x + (nextDx / nextDistNonZero) * actualRadius;
                const control2Y = nextDist === 0 ? current.y : current.y + (nextDy / nextDistNonZero) * actualRadius;


                //  Line to the start of the curve.
                if (i === 1) {
                    path = `M ${control1X},${control1Y} `;
                } else {
                    path += `L ${control1X},${control1Y} `;
                }

                // Cubic Bezier curve:  Handle zero radius explicitly
                if (actualRadius === 0) {
                   path += `L ${next.x},${next.y} `; // No curve, just a straight line
                   i++; // Correctly advance 'i' for next iteration
                   if(i < len){
                       const afterNext = coords[(i + 1) % len];
                       path += `M ${afterNext.x},${afterNext.y} `;
                   }
                }
                else{
                   path += `C ${current.x},${current.y} ${current.x},${current.y} ${control2X},${control2Y} `;
                }
            }
        }

        if (close) {
            path += "Z";
        }
        return path;
    }



    /**
     * Converts an array of points (objects with x, y, and optional cornerRadius)
     * into an SVG path 'd' attribute string.  Now uses createRoundedPath.
     *
     * @param {Array<object>} points Array of points. Each point should have
     *  x and y properties, and optionally a `cornerRadius` property.
     * @returns {string} The SVG path 'd' attribute string.
     */
    pointsToPath(points) {
        if (!points || points.length === 0) {
            return "";
        }

        const xKey = this.xKey;
        const yKey = this.yKey;

        // Extract coordinates, preserving cornerRadius.  Crucially, don't discard it.
        const coords = points.map(p => ({
            x: p[xKey],
            y: p[yKey],
            cornerRadius: p['corner-radius'] !== undefined ? p['corner-radius'] : p.cornerRadius// Keep cornerRadius!
        }));


        // Use the cornerRadius from the first point as the *default* if provided.
        const defaultRadius = coords[0].cornerRadius !== undefined ? coords[0].cornerRadius : this.defaultCornerRadius;
        return this.createRoundedPath(coords, defaultRadius, this.closePath);
    }


    /**
     * Converts a JSON string defining the path (including points and properties)
     * into an SVG path element string.
     *
     * JSON format:
     * {
     *   "points": [ { "x": 10, "y": 10, "cornerRadius": 5 }, ... ], // Array of points
     *   "stroke": "blue",          // Optional stroke color
     *   "fill": "lightblue",        // Optional fill color
     *   "stroke-width": 2,         // Optional stroke width (use SVG attribute names)
     *   "closePath": true,         // Optional, override default closePath
     *   ...                        // Add any other SVG path attributes as needed
     * }
     *
     * @param {string} jsonPathDefinition JSON string defining the path.
     * @returns {string} The complete SVG path element string (<path ... />).
     */
    generateSvgPathElementFromJson(jsonPathDefinition) {
        try {
            const pathData = JSON.parse(jsonPathDefinition);
            const points = pathData.points;
            if (!Array.isArray(points)) {
                console.error("JSON Path Definition Error: 'points' array is missing or not an array.");
                return '<path d="" />'; // Return minimal invalid path
            }

            // Get closePath from JSON if available, else use the instance default
            const closePath = pathData.hasOwnProperty('closePath') ? pathData.closePath : this.closePath;
            this.closePath = closePath; // Update instance closePath
            const dAttribute = this.pointsToPath(points);
            let attributesString = `d="${dAttribute}"`;

            // Add SVG attributes from JSON (stroke, fill, stroke-width, etc.)
            for (const key in pathData) {
                if (key !== 'points' && key !== 'closePath') { // Don't add points again, handle closePath
                    attributesString += ` ${key}="${pathData[key]}"`;
                }
            }

            return `<path ${attributesString} />`;

        } catch (e) {
            console.error("Error parsing JSON path definition:", e);
            return '<path d="" />'; // Return minimal invalid path in case of error
        }
    }


    /**
     * Decodes an SVG path string back into an array of points.
     *  Now handles 'C' (cubic Bezier) commands, extracting the *end* point of the curve.
     *
     * @param {string} pathString The SVG path 'd' attribute string to decode.
     * @returns {Array<object>} An array of point objects, each with x and y properties.
     */
    pathToPoints(pathString) {
        const points = [];
        const commands = pathString.trim().split(/(?=[MLAZC])/i); // Split into commands, include C

        let currentX = 0;
        let currentY = 0;

        for (const command of commands) {
            const parts = command.trim().split(/[ ,]+/);  //Split by spaces or commas
            const type = parts[0].toUpperCase();

            switch (type) {
                case "M": // Move to
                    currentX = parseFloat(parts[1]);
                    currentY = parseFloat(parts[2]);
                    points.push({ x: currentX, y: currentY });
                    break;
                case "L": // Line to
                    currentX = parseFloat(parts[1]);
                    currentY = parseFloat(parts[2]);
                    points.push({ x: currentX, y: currentY });
                    break;
                case "A": // Arc (simplified)
                    currentX = parseFloat(parts[6]);
                    currentY = parseFloat(parts[7]);
                    points.push({ x: currentX, y: currentY });
                    break;
                case "Q": // Quadratic Bezier (simplified)
                    currentX = parseFloat(parts[3]);
                    currentY = parseFloat(parts[4]);
                    points.push({ x: currentX, y: currentY });
                    break;
                case "C": // Cubic Bezier - Extract end point
                    currentX = parseFloat(parts[5]);
                    currentY = parseFloat(parts[6]);
                    points.push({ x: currentX, y: currentY });
                    break;
                case "Z": // Close path
                    if (points.length > 0) {
                        points.push({ x: points[0].x, y: points[0].y });
                        currentX = points[0].x;
                        currentY = points[0].y;
                    }
                    break;
                default:
                    console.warn(`Unknown SVG path command: ${type}`);
            }
        }

        return points;
    }



    /**
     * Decodes a JSON string containing an SVG path 'd' attribute string into a JSON string of points.
     * (Decoder remains the same from previous versions)
     *
     * @param {string} svgPathJsonString JSON string containing the SVG path 'd' attribute string.
     * @returns {string} JSON string representing an array of point objects.
     */
    svgPathStringToJsonPoints(svgPathJsonString) { // ... (same svgPathStringToJsonPoints implementation as before) ...
        try {
            const pathString = JSON.parse(svgPathJsonString);
            const points = this.pathToPoints(pathString);
            return JSON.stringify(points);
        } catch (e) {
            console.error("Error parsing JSON path string or stringifying points:", e);
            return "[]"; // Or handle error as needed, return empty JSON array in case of error
        }
    }


    /** Helper methods for debugging/testing - not directly related to JSON but kept for completeness */
    pathToString(pathString) {
        return pathString.trim();
    }
    pathToStringWithoutFirstM(pathString) {
        const trimmedPath = pathString.trim();
        if (!trimmedPath.startsWith("M") && !trimmedPath.startsWith("m")) return trimmedPath;
        let firstMIndex = 0;
        for (let i = 0; i < trimmedPath.length; i++) {
            const char = trimmedPath[i];
            if (char === ' ' || char === ',') {
                firstMIndex = i;
                break;
            }
        }
        return trimmedPath.substring(firstMIndex).trim();
    }


}

// Export the class if you are using modules
// if (typeof module !== 'undefined' && module.exports) {
//   module.exports = SVGPathGenerator;
// }
