import React, { useState, useEffect, useRef, useCallback } from 'react';
import '@site/src/css/erd-diagram.css';

/**
 * ERD Diagram Component for rendering PostgreSQL schema diagrams
 * @param {Object} props Component properties
 * @param {string} props.dataFile Path to JSON metadata file
 * @param {string[]} props.schemas Array of schema names to display (optional)
 * @param {string[]} props.tables Array of table names to display (optional)
 * @param {string} props.layout Layout type: 'grid', 'circular', 'tree' (default: 'circular')
 * @param {number} props.width Container width (optional)
 * @param {number} props.height Container height (optional)
 */
const ERDDiagram = ({
                        dataFile,
                        schemas = [],
                        tables = [],
                        layout = 'circular',
                        width,
                        height
                    }) => {
    const [metadata, setMetadata] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [tablePositions, setTablePositions] = useState({});
    const [manuallyPositioned, setManuallyPositioned] = useState(new Set());
    const [selectedTable, setSelectedTable] = useState(null);
    const [currentLayout, setLayout] = useState(layout);
    const [zoom, setZoom] = useState(1);
    const [pan, setPan] = useState({ x: -1500, y: -1500 }); // Center the large canvas in viewport
    const [isDragging, setIsDragging] = useState(false);
    const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
    const [visibleSchemas, setVisibleSchemas] = useState(new Set());
    const [highlightedRelations, setHighlightedRelations] = useState(new Set());
    const [collapsedTables, setCollapsedTables] = useState(new Set());
    const [allTablesCollapsed, setAllTablesCollapsed] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [highlightedColumns, setHighlightedColumns] = useState(new Set());
    const [highlightedTables, setHighlightedTables] = useState(new Set());
    const [showAllResults, setShowAllResults] = useState(false);

    const canvasRef = useRef(null);
    const containerRef = useRef(null);

    // Load metadata from JSON file
    useEffect(() => {
        const loadMetadata = async () => {
            try {
                setLoading(true);
                const response = await fetch(dataFile);
                if (!response.ok) {
                    throw new Error(`Failed to load ${dataFile}: ${response.statusText}`);
                }
                const data = await response.json();
                setMetadata(data);

                // Initialize visible schemas
                const allSchemas = new Set(data.schemas?.map(s => s.name) || []);
                setVisibleSchemas(schemas.length > 0 ? new Set(schemas) : allSchemas);

                // Initialize all tables as collapsed
                const allTables = new Set();
                data.schemas?.forEach(schema => {
                    schema.tables?.forEach(table => {
                        allTables.add(`${schema.name}.${table.name}`);
                    });
                });
                setCollapsedTables(allTables);

                setError(null);
            } catch (err) {
                setError(`Error loading ERD data: ${err.message}`);
                console.error('ERD loading error:', err);
            } finally {
                setLoading(false);
            }
        };

        if (dataFile) {
            loadMetadata();
        }
    }, [dataFile]);

    // Build hierarchy tree from relationships
    const buildHierarchyTree = useCallback(() => {
        if (!metadata?.schemas || !metadata?.relationships) return null;

        const allTables = new Map();
        const children = new Map(); // parent -> Set of children
        const parents = new Map();  // child -> parent

        // Initialize all visible tables
        metadata.schemas.forEach(schema => {
            if (!visibleSchemas.has(schema.name)) return;
            schema.tables?.forEach(table => {
                const tableKey = `${schema.name}.${table.name}`;
                allTables.set(tableKey, { schema: schema.name, table: table.name, level: 0 });
                children.set(tableKey, new Set());
            });
        });

        // Build parent-child relationships
        metadata.relationships.forEach(rel => {
            const sourceKey = `${rel.sourceSchema}.${rel.sourceTable}`;
            const targetKey = `${rel.targetSchema}.${rel.targetTable}`;
            
            // Only process relationships where both tables are visible
            if (allTables.has(sourceKey) && allTables.has(targetKey)) {
                // Foreign key points from child to parent
                // So sourceTable is child, targetTable is parent
                children.get(targetKey).add(sourceKey);
                parents.set(sourceKey, targetKey);
            }
        });

        // Find root tables (tables with no parents)
        const roots = [];
        allTables.forEach((tableData, tableKey) => {
            if (!parents.has(tableKey)) {
                roots.push(tableKey);
            }
        });

        // Assign levels using BFS
        const visited = new Set();
        const queue = roots.map(root => ({ key: root, level: 0 }));
        
        while (queue.length > 0) {
            const { key, level } = queue.shift();
            if (visited.has(key)) continue;
            
            visited.add(key);
            allTables.get(key).level = level;
            
            // Add children to queue with next level
            children.get(key).forEach(childKey => {
                if (!visited.has(childKey)) {
                    queue.push({ key: childKey, level: level + 1 });
                }
            });
        }

        // Handle orphaned tables (circular dependencies or isolated tables)
        allTables.forEach((tableData, tableKey) => {
            if (!visited.has(tableKey)) {
                tableData.level = 0; // Put orphaned tables at root level
                roots.push(tableKey);
            }
        });

        return { allTables, children, parents, roots };
    }, [metadata, visibleSchemas]);

    // Calculate table positions based on layout
    const calculateTablePositions = useCallback(() => {
        if (!metadata?.schemas) return;

        // Use the center of the large canvas (4000x4000)
        const centerX = 2000;
        const centerY = 2000;
        const positions = {};

        // Filter tables based on props
        const filteredTables = [];
        metadata.schemas.forEach(schema => {
            if (!visibleSchemas.has(schema.name)) return;

            schema.tables?.forEach(table => {
                if (tables.length === 0 || tables.includes(table.name)) {
                    filteredTables.push({ ...table, schema: schema.name });
                }
            });
        });

        const tableCount = filteredTables.length;
        if (tableCount === 0) return;

        filteredTables.forEach((table, index) => {
            const key = `${table.schema}.${table.name}`;
            
            // Skip if this table was manually positioned
            if (manuallyPositioned.has(key)) return;

            switch (currentLayout) {
                case 'grid':
                    const cols = Math.ceil(Math.sqrt(tableCount));
                    const row = Math.floor(index / cols);
                    const col = index % cols;
                    
                    // Calculate spacing to prevent overlap (table width + padding)
                    const tableWidth = 200;
                    const tablePadding = 10; // Very tight padding between tables
                    const baseSpacingX = tableWidth + tablePadding;
                    const baseSpacingY = 80; // Very tight vertical spacing
                    
                    // Use base spacing without zoom scaling
                    const spacingX = baseSpacingX;
                    const spacingY = baseSpacingY;
                    
                    // Center the grid layout
                    const totalGridWidth = (cols - 1) * spacingX;
                    const totalGridHeight = (Math.ceil(tableCount / cols) - 1) * spacingY;
                    const gridStartX = centerX - (totalGridWidth / 2);
                    const gridStartY = centerY - (totalGridHeight / 2);
                    
                    positions[key] = {
                        x: gridStartX + (col * spacingX),
                        y: gridStartY + (row * spacingY)
                    };
                    break;

                case 'circular': {
                    // Calculate radius based on table count and table dimensions
                    const tableWidth = 200;
                    const tableMinHeight = 60; // Collapsed table height
                    const tableMaxHeight = 350; // Expanded table height with many columns

                    // Determine the tallest visible table to ensure enough vertical spacing
                    let tallest = tableMinHeight;
                    metadata.schemas.forEach(s => {
                        if (!visibleSchemas.has(s.name)) return;
                        s.tables?.forEach(t => {
                            const k = `${s.name}.${t.name}`;
                            const collapsed = collapsedTables.has(k);
                            const h = collapsed ? tableMinHeight : Math.min(tableMaxHeight, tableMinHeight + (t.columns?.length || 0) * 24);
                            if (h > tallest) tallest = h;
                        });
                    });

                    const safeCenterX = centerX;
                    const safeCenterY = centerY;

                    // Base circumference uses the larger of width or tallest height
                    const maxDim = Math.max(tableWidth, tallest);
                    const baseCircumference = tableCount * maxDim;
                    const scaledCircumference = baseCircumference * 1.1; // 10% extra space

                    const calculatedRadius = scaledCircumference / (2 * Math.PI);
                    const radius = Math.max(150, calculatedRadius);

                    const angle = (index / tableCount) * 2 * Math.PI;
                    const currentHeight = tallest; // use tallest for centering
                    positions[key] = {
                        x: safeCenterX + radius * Math.cos(angle) - (tableWidth / 2),
                        y: safeCenterY + radius * Math.sin(angle) - (currentHeight / 2)
                    };
                    break;
                }

                case 'tree': {
                    const hierarchy = buildHierarchyTree();
                    if (!hierarchy) break;
                    
                    const { allTables } = hierarchy;
                    
                    // Group tables by level
                    const levelGroups = new Map();
                    allTables.forEach((tableData, tableKey) => {
                        const level = tableData.level;
                        if (!levelGroups.has(level)) {
                            levelGroups.set(level, []);
                        }
                        levelGroups.get(level).push(tableKey);
                    });
                    
                    // Calculate layout dimensions with zoom effect
                    const maxLevel = Math.max(...Array.from(levelGroups.keys()));
                    const baseLevelHeight = 50; // Very tight vertical spacing between levels
                    const baseTableSpacing = 80; // Very tight horizontal spacing between tables
                    
                    // Use base spacing without zoom scaling
                    const levelHeight = baseLevelHeight;
                    const tableSpacing = baseTableSpacing;
                    
                    // Center the tree vertically by calculating total height and starting from center
                    const totalTreeHeight = maxLevel * levelHeight;
                    const startY = centerY - (totalTreeHeight / 2);
                    
                    // Position tables level by level
                    levelGroups.forEach((tablesInLevel, level) => {
                        const levelY = startY + (level * levelHeight);
                        const totalWidth = (tablesInLevel.length - 1) * tableSpacing;
                        const startX = centerX - (totalWidth / 2);
                        
                        tablesInLevel.forEach((tableKey, index) => {
                            if (tableKey === key) {
                                positions[key] = {
                                    x: startX + (index * tableSpacing),
                                    y: levelY
                                };
                            }
                        });
                    });
                    break;
                }

                default: {
                    // Fallback to circular layout
                    const fallbackAngle = (index / tableCount) * 2 * Math.PI;
                    const fallbackRadius = Math.min(centerX, centerY) * 0.6;
                    positions[key] = {
                        x: centerX + fallbackRadius * Math.cos(fallbackAngle) - 100,
                        y: centerY + fallbackRadius * Math.sin(fallbackAngle) - 100
                    };
                    break;
                }
            }
        });

        setTablePositions(prev => ({ ...prev, ...positions }));
    }, [metadata, currentLayout, tables, visibleSchemas, manuallyPositioned, buildHierarchyTree]);


    // Calculate optimal zoom to fit all tables in viewport
    const calculateOptimalZoom = useCallback(() => {
        if (!metadata?.schemas || !containerRef.current || Object.keys(tablePositions).length === 0) return;

        const container = containerRef.current;
        const rect = container.getBoundingClientRect();
        
        // Account for UI controls spacing
        const controlsMargin = 80; // Space for top controls
        const searchMargin = 80; // Space for bottom search
        const schemaMargin = 220; // Space for right schema filter
        const leftMargin = 20; // Left margin
        
        const availableWidth = rect.width - schemaMargin - leftMargin;
        const availableHeight = rect.height - controlsMargin - searchMargin;
        
        // Find the bounds of all table positions
        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
        
        Object.values(tablePositions).forEach(position => {
            const tableWidth = 200;
            const tableHeight = 150; // Estimated table height
            
            minX = Math.min(minX, position.x);
            maxX = Math.max(maxX, position.x + tableWidth);
            minY = Math.min(minY, position.y);
            maxY = Math.max(maxY, position.y + tableHeight);
        });
        
        if (minX === Infinity) return; // No tables positioned yet
        
        // Calculate required dimensions with minimal padding for tighter fit
        const padding = 40;
        const requiredWidth = (maxX - minX) + (padding * 2);
        const requiredHeight = (maxY - minY) + (padding * 2);
        
        // Calculate zoom ratios to fit content
        const zoomX = availableWidth / requiredWidth;
        const zoomY = availableHeight / requiredHeight;
        
        // Use the smaller ratio to ensure everything fits, but with higher minimum zoom
        const optimalZoom = Math.min(Math.min(zoomX, zoomY), 2.0); // Max zoom of 2.0x
        const finalZoom = Math.max(optimalZoom, 0.6); // Min zoom of 0.6x for better visibility
        
        if (finalZoom !== zoom) {
            setZoom(finalZoom);
        }
    }, [metadata, tablePositions, zoom]);

    // Center the diagram in the viewport
    const centerDiagram = useCallback(() => {
        if (!containerRef.current || Object.keys(tablePositions).length === 0) return;

        const container = containerRef.current;
        const rect = container.getBoundingClientRect();
        
        // Find the bounds of all table positions
        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
        
        Object.values(tablePositions).forEach(position => {
            const tableWidth = 200;
            const tableHeight = 150;
            
            minX = Math.min(minX, position.x);
            maxX = Math.max(maxX, position.x + tableWidth);
            minY = Math.min(minY, position.y);
            maxY = Math.max(maxY, position.y + tableHeight);
        });
        
        if (minX === Infinity) return;
        
        // Calculate the center of all tables
        const contentCenterX = (minX + maxX) / 2;
        const contentCenterY = (minY + maxY) / 2;
        
        // Calculate the center of the available viewport (accounting for UI controls)
        const controlsMargin = 80;
        const searchMargin = 80;
        const schemaMargin = 220;
        const leftMargin = 20;
        
        const viewportCenterX = leftMargin + (rect.width - schemaMargin - leftMargin) / 2;
        const viewportCenterY = controlsMargin + (rect.height - controlsMargin - searchMargin) / 2;
        
        // Calculate pan to center the content (scaled by zoom)
        const newPan = {
            x: viewportCenterX - (contentCenterX * zoom),
            y: viewportCenterY - (contentCenterY * zoom)
        };
        
        setPan(newPan);
    }, [tablePositions, zoom]);

    // Calculate bounds of all visible tables
    const calculateTableBounds = useCallback(() => {
        if (!metadata?.schemas || Object.keys(tablePositions).length === 0) return null;

        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
        let hasAnyTable = false;

        metadata.schemas.forEach(schema => {
            if (!visibleSchemas.has(schema.name)) return;
            schema.tables?.forEach(table => {
                const tableKey = `${schema.name}.${table.name}`;
                const position = tablePositions[tableKey];
                if (position) {
                    hasAnyTable = true;
                    const isCollapsed = collapsedTables.has(tableKey);
                    const tableWidth = 200;
                    const tableHeight = isCollapsed ? 60 : Math.min(350, 60 + (table.columns?.length || 0) * 24);
                    
                    minX = Math.min(minX, position.x);
                    maxX = Math.max(maxX, position.x + tableWidth);
                    minY = Math.min(minY, position.y);
                    maxY = Math.max(maxY, position.y + tableHeight);
                }
            });
        });

        if (!hasAnyTable) return null;

        return { minX, maxX, minY, maxY, width: maxX - minX, height: maxY - minY };
    }, [metadata, tablePositions, visibleSchemas, collapsedTables]);

    // Spread apart any overlapping tables
    const spreadOverlappingTables = useCallback(() => {
        if (!metadata?.schemas) return;

        const getTableInfo = (positions) => {
            const list = [];
            metadata.schemas.forEach(schema => {
                if (!visibleSchemas.has(schema.name)) return;
                schema.tables?.forEach(table => {
                    const key = `${schema.name}.${table.name}`;
                    const pos = positions[key];
                    if (!pos) return;
                    const collapsed = collapsedTables.has(key);
                    const width = 200;
                    const height = collapsed ? 60 : Math.min(350, 60 + (table.columns?.length || 0) * 24);
                    list.push({ key, x: pos.x, y: pos.y, width, height });
                });
            });
            return list;
        };

        const rectanglesOverlap = (a, b) => (
            a.x < b.x + b.width &&
            a.x + a.width > b.x &&
            a.y < b.y + b.height &&
            a.y + a.height > b.y
        );

        let positions = { ...tablePositions };
        let iterations = 0;
        const maxIterations = 20;

        while (iterations < maxIterations) {
            const tables = getTableInfo(positions);
            let moved = false;

            for (let i = 0; i < tables.length; i++) {
                for (let j = i + 1; j < tables.length; j++) {
                    const a = tables[i];
                    const b = tables[j];
                    if (rectanglesOverlap(a, b)) {
                        const dx = (a.x + a.width / 2) - (b.x + b.width / 2);
                        const dy = (a.y + a.height / 2) - (b.y + b.height / 2);
                        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
                        const push = 50;
                        const offsetX = (dx / dist) * push;
                        const offsetY = (dy / dist) * push;

                        positions[a.key] = {
                            x: positions[a.key].x + offsetX,
                            y: positions[a.key].y + offsetY
                        };
                        positions[b.key] = {
                            x: positions[b.key].x - offsetX,
                            y: positions[b.key].y - offsetY
                        };
                        moved = true;
                    }
                }
            }

            if (!moved) break;
            iterations += 1;
        }

        setTablePositions(prev => ({ ...prev, ...positions }));
    }, [metadata, visibleSchemas, collapsedTables, tablePositions]);

    // Auto-adjust zoom and position to fit all tables with proper spacing
    const autoFitTables = useCallback(() => {
        if (!containerRef.current) return;

        const bounds = calculateTableBounds();
        if (!bounds) return;

        const container = containerRef.current;
        const rect = container.getBoundingClientRect();
        
        // Account for UI controls spacing
        const controlsMargin = 80;
        const searchMargin = 80;
        const schemaMargin = 220;
        const leftMargin = 20;
        
        const availableWidth = rect.width - schemaMargin - leftMargin;
        const availableHeight = rect.height - controlsMargin - searchMargin;
        
        // Add minimal padding around the content for tighter fit
        const padding = 40;
        const requiredWidth = bounds.width + (padding * 2);
        const requiredHeight = bounds.height + (padding * 2);
        
        // Calculate zoom ratios to fit content
        const zoomX = availableWidth / requiredWidth;
        const zoomY = availableHeight / requiredHeight;
        
        // Use the smaller ratio to ensure everything fits with better visibility
        const optimalZoom = Math.min(zoomX, zoomY, 2.0); // Cap at 2.0x
        const finalZoom = Math.max(optimalZoom, 0.6); // Min zoom of 0.6x for better visibility
        
        setZoom(finalZoom);
        
        // Center the content after zoom adjustment
        setTimeout(() => {
            const newBounds = calculateTableBounds();
            if (!newBounds) return;
            
            const contentCenterX = (newBounds.minX + newBounds.maxX) / 2;
            const contentCenterY = (newBounds.minY + newBounds.maxY) / 2;
            
            const viewportCenterX = leftMargin + availableWidth / 2;
            const viewportCenterY = controlsMargin + availableHeight / 2;
            
            setPan({
                x: viewportCenterX - (contentCenterX * finalZoom),
                y: viewportCenterY - (contentCenterY * finalZoom)
            });
        }, 100);
    }, [calculateTableBounds, setZoom, setPan]);

    // Initialize table positions
    useEffect(() => {
        if (metadata && canvasRef.current) {
            setTimeout(calculateTablePositions, 100); // Allow DOM to render
        }
    }, [metadata, calculateTablePositions]);

    // Auto-fit and center diagram only on initial load (not every position change)
    const [hasInitialized, setHasInitialized] = useState(false);
    useEffect(() => {
        if (Object.keys(tablePositions).length > 0 && !hasInitialized) {
            setTimeout(() => {
                autoFitTables(); // This calculates optimal zoom and centers properly
                setHasInitialized(true); // Prevent future auto-adjustments
            }, 200);
        }
    }, [tablePositions, autoFitTables, hasInitialized]);


    // Handle table drag
    const handleTableMouseDown = useCallback((e, tableKey) => {
        e.preventDefault();
        e.stopPropagation();

        const startX = e.clientX;
        const startY = e.clientY;
        const startPos = tablePositions[tableKey] || { x: 0, y: 0 };

        const handleMouseMove = (moveEvent) => {
            const deltaX = (moveEvent.clientX - startX) / zoom;
            const deltaY = (moveEvent.clientY - startY) / zoom;

            setTablePositions(prev => ({
                ...prev,
                [tableKey]: {
                    x: startPos.x + deltaX,
                    y: startPos.y + deltaY
                }
            }));
        };

        const handleMouseUp = () => {
            setManuallyPositioned(prev => new Set([...prev, tableKey]));
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };

        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
    }, [tablePositions, zoom]);

    // Handle canvas pan
    const handleCanvasMouseDown = useCallback((e) => {
        // Check if we should start panning - exclude tables and controls
        const target = e.target;
        
        // Don't pan if clicking on tables, controls, or interactive elements
        const isTable = target.closest('.erd-table');
        const isControl = target.closest('.erd-controls') || target.closest('.erd-schema-filter') || target.closest('.erd-search-container');
        const isInteractive = target.tagName === 'BUTTON' || target.tagName === 'INPUT' || target.tagName === 'SELECT' || target.tagName === 'path' || target.tagName === 'text';
        
        // Allow panning on canvas background, SVG background, or div elements that aren't tables/controls
        const canPan = !isTable && !isControl && !isInteractive;
        
        if (canPan) {
            e.preventDefault();
            setIsDragging(true);
            setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
        }
    }, [pan]);

    const handleCanvasMouseMove = useCallback(() => {
        // Mouse move is now handled by global document listener for better drag behavior
    }, []);

    const handleCanvasMouseUp = useCallback(() => {
        setIsDragging(false);
    }, []);

    // Handle mouse leave to stop dragging when cursor leaves canvas
    const handleCanvasMouseLeave = useCallback(() => {
        setIsDragging(false);
    }, []);

    // Navigate to a specific table and bring it into view
    const navigateToTable = useCallback((tableKey) => {
        const position = tablePositions[tableKey];
        if (!position || !containerRef.current) return;

        const container = containerRef.current;
        const rect = container.getBoundingClientRect();

        const controlsMargin = 80;
        const searchMargin = 80;
        const schemaMargin = 220;
        const leftMargin = 20;

        const viewportCenterX = leftMargin + (rect.width - schemaMargin - leftMargin) / 2;
        const viewportCenterY = controlsMargin + (rect.height - controlsMargin - searchMargin) / 2;

        const tableCenterX = (position.x + 100) * zoom;
        const tableCenterY = (position.y + 50) * zoom;

        const newPan = {
            x: viewportCenterX - tableCenterX,
            y: viewportCenterY - tableCenterY
        };

        setPan(newPan);
    }, [tablePositions, zoom]);

    // Handle zoom
    const handleZoom = useCallback((delta) => {
        if (!containerRef.current) return;
        
        const container = containerRef.current;
        const rect = container.getBoundingClientRect();
        
        // Calculate the center of the viewport
        const viewportCenterX = rect.width / 2;
        const viewportCenterY = rect.height / 2;
        
        setZoom(prev => {
            const oldZoom = prev;
            const newZoom = Math.max(0.1, Math.min(3, prev + delta));
            
            // Calculate the point in canvas coordinates that should stay fixed (viewport center)
            const canvasPointX = (viewportCenterX - pan.x) / oldZoom;
            const canvasPointY = (viewportCenterY - pan.y) / oldZoom;
            
            // Calculate new pan to keep the same canvas point at viewport center
            const newPanX = viewportCenterX - (canvasPointX * newZoom);
            const newPanY = viewportCenterY - (canvasPointY * newZoom);
            
            setPan({ x: newPanX, y: newPanY });
            
            return newZoom;
        });
    }, [pan, setPan]);

    // Removed wheel handler - let mouse wheel scroll table columns naturally

    // Get relationships for rendering
    const getFilteredRelationships = useCallback(() => {
        if (!metadata?.relationships) return [];

        return metadata.relationships.filter(rel => {
            const sourceKey = `${rel.sourceSchema}.${rel.sourceTable}`;
            const targetKey = `${rel.targetSchema}.${rel.targetTable}`;
            
            // Only show relationships where both schemas are visible
            const sourceSchemaVisible = visibleSchemas.has(rel.sourceSchema);
            const targetSchemaVisible = visibleSchemas.has(rel.targetSchema);
            
            return sourceSchemaVisible && 
                   targetSchemaVisible && 
                   tablePositions[sourceKey] && 
                   tablePositions[targetKey];
        });
    }, [metadata, tablePositions, visibleSchemas, zoom]);

    // Handle table hover for relationship highlighting
    const handleTableHover = useCallback((tableKey, isHovering) => {
        if (!isHovering) {
            setHighlightedRelations(new Set());
            return;
        }

        const [schema, table] = tableKey.split('.');
        const relatedRelations = new Set();

        metadata?.relationships?.forEach(rel => {
            if ((rel.sourceSchema === schema && rel.sourceTable === table) ||
                (rel.targetSchema === schema && rel.targetTable === table)) {
                relatedRelations.add(rel.name);
            }
        });

        setHighlightedRelations(relatedRelations);
    }, [metadata]);

    // Global document events for mouse tracking during drag
    useEffect(() => {
        const handleDocumentMouseMove = (e) => {
            if (isDragging) {
                e.preventDefault();
                const newPan = {
                    x: e.clientX - dragStart.x,
                    y: e.clientY - dragStart.y
                };
                setPan(newPan);
            }
        };

        const handleDocumentMouseUp = () => {
            setIsDragging(false);
        };

        // Attach global document events for dragging
        document.addEventListener('mousemove', handleDocumentMouseMove, { passive: false });
        document.addEventListener('mouseup', handleDocumentMouseUp);

        return () => {
            document.removeEventListener('mousemove', handleDocumentMouseMove);
            document.removeEventListener('mouseup', handleDocumentMouseUp);
        };
    }, [isDragging, dragStart]);

    // Render table component
    const renderTable = (table, schema) => {
        const tableKey = `${schema}.${table.name}`;
        const position = tablePositions[tableKey] || { x: 0, y: 0 };
        const isSelected = selectedTable === tableKey;
        const isCollapsed = collapsedTables.has(tableKey);

        const isSearchHighlighted = highlightedTables.has(tableKey);

        return (
            <div
                key={tableKey}
                className={`erd-table ${isSelected ? 'selected' : ''} ${isSearchHighlighted ? 'search-highlighted' : ''}`}
                style={{
                    left: position.x,
                    top: position.y,
                    cursor: 'move'
                }}
                onMouseDown={(e) => handleTableMouseDown(e, tableKey)}
                onMouseEnter={() => handleTableHover(tableKey, true)}
                onMouseLeave={() => handleTableHover(tableKey, false)}
                onClick={() => setSelectedTable(isSelected ? null : tableKey)}
            >
                <div className="erd-table-header">
                    <div>
                        <div className="erd-table-name">{table.name}</div>
                        <div className="erd-table-schema">{schema}</div>
                    </div>
                    <button
                        className="erd-table-toggle"
                        onClick={(e) => {
                            e.stopPropagation();
                            toggleTableCollapse(tableKey);
                        }}
                        title={isCollapsed ? "Expand table" : "Collapse table"}
                    >
                        {isCollapsed ? "+" : "−"}
                    </button>
                </div>
                {!isCollapsed && (
                <div className="erd-table-body">
                    {table.columns?.map(column => {
                        const isPK = column.isPrimaryKey;
                        const isFK = metadata?.relationships?.some(rel =>
                            rel.sourceSchema === schema &&
                            rel.sourceTable === table.name &&
                            rel.sourceColumn === column.name
                        );
                        const isTarget = metadata?.relationships?.some(rel =>
                            rel.targetSchema === schema &&
                            rel.targetTable === table.name &&
                            rel.targetColumn === column.name
                        );
                        
                        // Find which relationship this column is part of for positioning the anchor
                        const relationship = metadata?.relationships?.find(rel =>
                            (rel.sourceSchema === schema && rel.sourceTable === table.name && rel.sourceColumn === column.name) ||
                            (rel.targetSchema === schema && rel.targetTable === table.name && rel.targetColumn === column.name)
                        );
                        
                        // Determine anchor side based on relationship direction
                        const getAnchorSide = () => {
                            if (!relationship) return 'right';
                            
                            const tableKey = `${schema}.${table.name}`;
                            const currentPos = tablePositions[tableKey];
                            
                            let otherTableKey, otherPos;
                            if (isFK) {
                                // This is a foreign key, find the target table
                                otherTableKey = `${relationship.targetSchema}.${relationship.targetTable}`;
                            } else if (isTarget) {
                                // This is a target, find the source table  
                                otherTableKey = `${relationship.sourceSchema}.${relationship.sourceTable}`;
                            }
                            
                            otherPos = tablePositions[otherTableKey];
                            
                            if (!currentPos || !otherPos) return 'right';
                            
                            // Calculate which side is closer
                            const currentCenterX = currentPos.x + 100; // half table width
                            const otherCenterX = otherPos.x + 100;
                            
                            return otherCenterX > currentCenterX ? 'right' : 'left';
                        };
                        
                        const anchorSide = getAnchorSide();

                        const columnKey = `${schema}.${table.name}.${column.name}`;
                        const isHighlighted = highlightedColumns.has(columnKey);
                        
                        return (
                            <div
                                key={column.name}
                                className={`erd-column ${isPK ? 'primary-key' : ''} ${isFK ? 'foreign-key' : ''} ${isTarget ? 'target-key' : ''} ${isHighlighted ? 'search-highlighted' : ''}`}
                                style={{ position: 'relative' }}
                            >
                                {/* Connection anchor for foreign key columns (source) */}
                                {isFK && (
                                    <div 
                                        className="connection-anchor source-anchor"
                                        style={{
                                            position: 'absolute',
                                            [anchorSide]: '-6px',
                                            top: '50%',
                                            transform: 'translateY(-50%)',
                                            width: '8px',
                                            height: '8px',
                                            backgroundColor: 'var(--ifm-color-info)',
                                            borderRadius: '50%',
                                            border: '2px solid var(--ifm-background-color)',
                                            zIndex: 15
                                        }}
                                        title={`Foreign Key: ${column.name}`}
                                    />
                                )}
                                
                                {/* Connection anchor for target columns (primary key being referenced) */}
                                {isTarget && (
                                    <div 
                                        className="connection-anchor target-anchor"
                                        style={{
                                            position: 'absolute',
                                            [anchorSide === 'right' ? 'left' : 'right']: '-6px',
                                            top: '50%',
                                            transform: 'translateY(-50%)',
                                            width: '8px',
                                            height: '8px',
                                            backgroundColor: 'var(--ifm-color-warning)',
                                            borderRadius: '50%',
                                            border: '2px solid var(--ifm-background-color)',
                                            zIndex: 15
                                        }}
                                        title={`Referenced by: ${relationship?.sourceTable}.${relationship?.sourceColumn}`}
                                    />
                                )}
                                
                                <div>
                                    <div className="erd-column-name">{column.name}</div>
                                    <div className="erd-column-type">
                                        {column.dataType}
                                        {column.maxLength ? `(${column.maxLength})` : ''}
                                        {!column.nullable ? ' NOT NULL' : ''}
                                    </div>
                                </div>
                                <div className="erd-column-icons">
                                    {isPK && <span className="erd-icon pk" title="Primary Key">🔑</span>}
                                    {isFK && <span className="erd-icon fk" title="Foreign Key">🔗</span>}
                                    {column.nullable && <span className="erd-icon nullable" title="Nullable">∅</span>}
                                </div>
                            </div>
                        );
                    })}
                </div>
                )}
            </div>
        );
    };

    // Calculate line path between tables
    const calculateRelationshipPath = (relationship) => {
        const sourceKey = `${relationship.sourceSchema}.${relationship.sourceTable}`;
        const targetKey = `${relationship.targetSchema}.${relationship.targetTable}`;

        const sourcePos = tablePositions[sourceKey];
        const targetPos = tablePositions[targetKey];

        if (!sourcePos || !targetPos) return null;

        // Check if tables are collapsed
        const sourceCollapsed = collapsedTables.has(sourceKey);
        const targetCollapsed = collapsedTables.has(targetKey);

        // Calculate connection points based on table state and proximity
        const tableHeaderHeight = 40; // Height of table header
        const rowHeight = 24; // Height of each column row
        const tableWidth = 200; // Table width
        const borderOffset = 2; // Border offset
        
        // Calculate table centers to determine closest sides
        const sourceCenterX = sourcePos.x + tableWidth / 2;
        const sourceCenterY = sourcePos.y + tableHeaderHeight / 2;
        const targetCenterX = targetPos.x + tableWidth / 2;
        const targetCenterY = targetPos.y + tableHeaderHeight / 2;
        
        // Determine which side of each table to connect from/to
        const sourceToTarget = {
            x: targetCenterX - sourceCenterX,
            y: targetCenterY - sourceCenterY
        };
        
        // Source connection point - choose side closest to target
        let sourceX, targetX, sourceY, targetY;
        
        if (Math.abs(sourceToTarget.x) > Math.abs(sourceToTarget.y)) {
            // Horizontal connection preferred
            if (sourceToTarget.x > 0) {
                // Target is to the right of source - connect from right side of source to left side of target
                sourceX = sourcePos.x + tableWidth + borderOffset;
                targetX = targetPos.x - borderOffset;
            } else {
                // Target is to the left of source - connect from left side of source to right side of target
                sourceX = sourcePos.x - borderOffset;
                targetX = targetPos.x + tableWidth + borderOffset;
            }
        } else {
            // Vertical connection preferred, but still use horizontal sides for better visibility
            if (sourceToTarget.x >= 0) {
                sourceX = sourcePos.x + tableWidth + borderOffset;
                targetX = targetPos.x - borderOffset;
            } else {
                sourceX = sourcePos.x - borderOffset;
                targetX = targetPos.x + tableWidth + borderOffset;
            }
        }
        
        // Calculate Y positions based on collapsed state
        if (sourceCollapsed) {
            // For collapsed tables, anchor to center of header
            sourceY = sourcePos.y + tableHeaderHeight / 2;
        } else {
            // For expanded tables, anchor to specific column
            const sourceColumnIndex = getColumnPosition(relationship.sourceSchema, relationship.sourceTable, relationship.sourceColumn);
            sourceY = sourcePos.y + tableHeaderHeight + (sourceColumnIndex * rowHeight) + (rowHeight / 2);
        }
        
        if (targetCollapsed) {
            // For collapsed tables, anchor to center of header
            targetY = targetPos.y + tableHeaderHeight / 2;
        } else {
            // For expanded tables, anchor to specific column
            const targetColumnIndex = getColumnPosition(relationship.targetSchema, relationship.targetTable, relationship.targetColumn);
            targetY = targetPos.y + tableHeaderHeight + (targetColumnIndex * rowHeight) + (rowHeight / 2);
        }

        // Create curved path for better visualization
        const deltaX = Math.abs(targetX - sourceX);
        const controlOffset = Math.min(deltaX * 0.3, 80); // Control offset
        
        // Determine direction for control points
        let controlX1, controlX2;
        if (sourceToTarget.x > 0) {
            // Target is to the right - curve outward from right side of source
            controlX1 = sourceX + controlOffset;
            controlX2 = targetX - controlOffset;
        } else {
            // Target is to the left - curve outward from left side of source
            controlX1 = sourceX - controlOffset;
            controlX2 = targetX + controlOffset;
        }

        const path = `M ${sourceX} ${sourceY} C ${controlX1} ${sourceY} ${controlX2} ${targetY} ${targetX} ${targetY}`;

        return { path, sourceX, sourceY, targetX, targetY };
    };

    // Get column position in table for precise connection points
    const getColumnPosition = (schema, tableName, columnName) => {
        const table = metadata?.schemas
            ?.find(s => s.name === schema)
            ?.tables?.find(t => t.name === tableName);
        
        if (!table?.columns) return 0;
        
        const columnIndex = table.columns.findIndex(col => col.name === columnName);
        return columnIndex >= 0 ? columnIndex : 0;
    };

    // Render relationship lines
    const renderRelationships = () => {
        const relationships = getFilteredRelationships();

        return (
            <svg 
                className={`erd-relationships ${isDragging ? 'dragging' : ''}`}
                style={{ 
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '4000px',
                    height: '4000px',
                    pointerEvents: 'none',
                    zIndex: 0
                }}
            >
                {(() => {
                    const labelPositions = [];
                    return relationships.map(relationship => {
                        const result = calculateRelationshipPath(relationship);
                        const isHighlighted = highlightedRelations.has(relationship.name);

                        if (!result) return null;

                        const { path, sourceX, sourceY, targetX, targetY } = result;

                        const baseX = (sourceX + targetX) / 2;
                        const baseY = (sourceY + targetY) / 2;

                        let labelX = baseX;
                        let labelY = baseY - 2;
                        let offset = 0;

                        while (labelPositions.some(p => Math.abs(p.x - labelX) < 40 && Math.abs(p.y - labelY) < 14) && offset < 70) {
                            offset += 14;
                            labelY = baseY - 2 + offset;
                        }

                        labelPositions.push({ x: labelX, y: labelY });

                        return (
                            <g key={relationship.name}>
                                <path
                                    d={path}
                                    className={`erd-relationship-line ${isHighlighted ? 'highlighted' : ''}`}
                                    stroke={isHighlighted ? "var(--ifm-color-warning)" : "var(--ifm-color-info)"}
                                    strokeWidth={isHighlighted ? 3 : 2}
                                    fill="none"
                                />
                                <text
                                    className="erd-relationship-label"
                                    x={labelX}
                                    y={labelY}
                                    textAnchor="middle"
                                    fontSize="12"
                                    fill="var(--ifm-color-content)"
                                    fontWeight="500"
                                    style={{ userSelect: 'none' }}
                                >
                                    {relationship.sourceColumn} → {relationship.targetColumn}
                                </text>
                            </g>
                        );
                    });
                })()}
            </svg>
        );
    };

    // Toggle schema visibility
    const toggleSchema = (schemaName) => {
        setVisibleSchemas(prev => {
            const newSet = new Set(prev);
            if (newSet.has(schemaName)) {
                newSet.delete(schemaName);
            } else {
                newSet.add(schemaName);
            }
            return newSet;
        });
        
        // Recalculate positions and auto-fit after schema toggle
        setTimeout(() => {
            calculateTablePositions();
            setTimeout(() => autoFitTables(), 200);
        }, 100);
    };

    // Reset view
    const resetView = () => {
        setManuallyPositioned(new Set());
        setIsDragging(false); // Stop any ongoing drag
        calculateTablePositions();
        setTimeout(() => {
            calculateOptimalZoom();
            setTimeout(() => {
                centerDiagram();
            }, 100);
        }, 100);
    };

    // Auto-arrange tables
    const autoArrange = () => {
        setManuallyPositioned(new Set());
        calculateTablePositions();
        setTimeout(() => {
            calculateOptimalZoom();
            setTimeout(() => {
                centerDiagram();
            }, 100);
        }, 100);
    };



    // Toggle individual table collapse state
    const toggleTableCollapse = useCallback((tableKey) => {
        const willExpand = collapsedTables.has(tableKey);

        setCollapsedTables(prev => {
            const newSet = new Set(prev);
            if (willExpand) {
                newSet.delete(tableKey);
            } else {
                newSet.add(tableKey);
            }

            // Update global state based on current state
            const totalVisibleTables = new Set();
            metadata?.schemas?.forEach(schema => {
                if (visibleSchemas.has(schema.name)) {
                    schema.tables?.forEach(table => {
                        totalVisibleTables.add(`${schema.name}.${table.name}`);
                    });
                }
            });

            setAllTablesCollapsed(newSet.size === totalVisibleTables.size);

            return newSet;
        });

        if (willExpand) {
            // Give the table time to expand before resolving overlaps
            setTimeout(() => spreadOverlappingTables(), 150);
        }
    }, [metadata, visibleSchemas, collapsedTables, spreadOverlappingTables]);



    // Toggle all tables collapse state
    const toggleAllTables = useCallback(() => {
        if (allTablesCollapsed) {
            // Expand all tables
            setCollapsedTables(new Set());
            setAllTablesCollapsed(false);
            // Auto-fit tables after expanding and resolve any overlaps
            setTimeout(() => {
                calculateTablePositions();
                setTimeout(() => {
                    spreadOverlappingTables();
                    setTimeout(() => autoFitTables(), 200);
                }, 100);
            }, 100);
        } else {
            // Collapse all tables
            const allTables = new Set();
            metadata?.schemas?.forEach(schema => {
                schema.tables?.forEach(table => {
                    if (visibleSchemas.has(schema.name)) {
                        allTables.add(`${schema.name}.${table.name}`);
                    }
                });
            });
            setCollapsedTables(allTables);
            setAllTablesCollapsed(true);
            // No auto-fit needed when collapsing - preserves current view
        }
    }, [allTablesCollapsed, metadata, visibleSchemas, calculateTablePositions, spreadOverlappingTables, autoFitTables]);

    // Fuzzy search algorithm - calculate similarity percentage
    const calculateSimilarity = (str1, str2) => {
        const s1 = str1.toLowerCase().trim();
        const s2 = str2.toLowerCase().trim();
        
        // Exact match should always return 100%
        if (s1 === s2) return 100;
        
        // Check for substring matches
        if (s1.includes(s2) || s2.includes(s1)) return 90;
        
        // Levenshtein distance based similarity
        const matrix = [];
        const len1 = s1.length;
        const len2 = s2.length;
        
        for (let i = 0; i <= len2; i++) {
            matrix[i] = [i];
        }
        
        for (let j = 0; j <= len1; j++) {
            matrix[0][j] = j;
        }
        
        for (let i = 1; i <= len2; i++) {
            for (let j = 1; j <= len1; j++) {
                if (s2.charAt(i - 1) === s1.charAt(j - 1)) {
                    matrix[i][j] = matrix[i - 1][j - 1];
                } else {
                    matrix[i][j] = Math.min(
                        matrix[i - 1][j - 1] + 1, // substitution
                        matrix[i][j - 1] + 1,     // insertion
                        matrix[i - 1][j] + 1      // deletion
                    );
                }
            }
        }
        
        const maxLen = Math.max(len1, len2);
        const similarity = ((maxLen - matrix[len2][len1]) / maxLen) * 100;
        return Math.round(similarity);
    };

    // Perform search across tables and columns
    const performSearch = useCallback((query) => {
        if (!query.trim() || !metadata?.schemas) {
            setSearchResults([]);
            setHighlightedColumns(new Set());
            return;
        }

        const results = [];

        metadata.schemas.forEach(schema => {
            if (!visibleSchemas.has(schema.name)) return;
            
            schema.tables?.forEach(table => {
                // Check table name similarity
                const tableNameSimilarity = calculateSimilarity(table.name, query);
                if (tableNameSimilarity >= 80) {
                    results.push({
                        type: 'table',
                        schema: schema.name,
                        table: table.name,
                        similarity: tableNameSimilarity,
                        key: `${schema.name}.${table.name}`
                    });
                }

                // Check column name similarity
                table.columns?.forEach(column => {
                    const columnSimilarity = calculateSimilarity(column.name, query);
                    
                    if (columnSimilarity >= 80) {
                        results.push({
                            type: 'column',
                            schema: schema.name,
                            table: table.name,
                            column: column.name,
                            similarity: columnSimilarity,
                            key: `${schema.name}.${table.name}.${column.name}`
                        });
                        }
                });
            });
        });

        // Sort results by similarity (highest first)
        results.sort((a, b) => b.similarity - a.similarity);

        setSearchResults(results);
        // Don't highlight columns during search - only when user clicks on a result
        
        // Don't auto-expand tables - let user click on search results to expand
    }, [metadata, visibleSchemas, collapsedTables]);

    // Handle search input
    const handleSearch = (query) => {
        setSearchQuery(query);
        // Clear highlights when searching
        setHighlightedColumns(new Set());
        setHighlightedTables(new Set());
        // Reset show all results state
        setShowAllResults(false);
        performSearch(query);
    };

    // Handle clicking on search result
    const handleSearchResultClick = (result) => {
        const tableKey = `${result.schema}.${result.table}`;
        
        // Expand the table
        setCollapsedTables(prev => {
            const newCollapsed = new Set(prev);
            newCollapsed.delete(tableKey);
            return newCollapsed;
        });

        // If it's a column result, highlight only that column
        if (result.type === 'column') {
            const columnKey = `${result.schema}.${result.table}.${result.column}`;
            setHighlightedColumns(new Set([columnKey]));
        } else {
            // If it's a table result, clear column highlighting
            setHighlightedColumns(new Set());
        }
        // Highlight the table itself
        setHighlightedTables(new Set([tableKey]));

        // Navigate to the table and bring it into view
        setTimeout(() => {
            navigateToTable(tableKey);
        }, 150); // Small delay to allow table to expand first

        // Update global collapsed state
        const totalVisibleTables = new Set();
        metadata?.schemas?.forEach(schema => {
            if (visibleSchemas.has(schema.name)) {
                schema.tables?.forEach(table => {
                    totalVisibleTables.add(`${schema.name}.${table.name}`);
                });
            }
        });
        
        const remainingCollapsed = new Set([...collapsedTables]);
        remainingCollapsed.delete(tableKey);
        setAllTablesCollapsed(remainingCollapsed.size === totalVisibleTables.size);

        // Just navigate to the table without auto-fitting to preserve view position

        // Clear search after selection
        setSearchQuery('');
        setSearchResults([]);
    };

    if (loading) {
        return (
            <div className="erd-container" style={{ width, height }}>
                <div className="erd-loading">
                    <div className="erd-spinner"></div>
                    Loading ERD diagram...
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="erd-container" style={{ width, height }}>
                <div className="erd-error">
                    {error}
                </div>
            </div>
        );
    }

    if (!metadata?.schemas?.length) {
        return (
            <div className="erd-container" style={{ width, height }}>
                <div className="erd-error">
                    No schema data found. Please check your data file.
                </div>
            </div>
        );
    }

    return (
        <div className="erd-container" ref={containerRef} style={{ width, height }}>
            {/* Controls */}
            <div className="erd-controls">
                <div className="erd-control-group">
                    <button className="erd-btn" onClick={() => handleZoom(0.1)} title="Zoom In (Use buttons for zoom)">
                        +
                    </button>
                    <button className="erd-btn" onClick={() => handleZoom(-0.1)} title="Zoom Out (Use buttons for zoom)">
                        -
                    </button>
                    <button className="erd-btn secondary" onClick={resetView} title="Reset View">
                        ⌂
                    </button>
                    <button 
                        className="erd-btn secondary" 
                        onClick={toggleAllTables} 
                        title={allTablesCollapsed ? "Expand All Tables" : "Collapse All Tables"}
                    >
                        {allTablesCollapsed ? "📂" : "📁"}
                    </button>
                </div>

                <div className="erd-control-group">
                    <select
                        className="erd-select"
                        value={currentLayout}
                        onChange={(e) => setLayout(e.target.value)}
                        title="Layout Type"
                    >
                        <option value="circular">Circular Layout</option>
                        <option value="grid">Grid Layout</option>
                        <option value="tree">Tree Layout</option>
                    </select>
                    <button className="erd-btn secondary" onClick={autoArrange} title="Auto Arrange">
                        ⚡
                    </button>
                </div>
            </div>

            {/* Schema Filter */}
            <div className="erd-schema-filter">
                <div className="erd-filter-title">Schemas</div>
                <div className="erd-filter-list">
                    {metadata.schemas.map(schema => (
                        <label key={schema.name} className="erd-filter-item">
                            <input
                                type="checkbox"
                                className="erd-filter-checkbox"
                                checked={visibleSchemas.has(schema.name)}
                                onChange={() => toggleSchema(schema.name)}
                            />
                            {schema.name} ({schema.tables?.length || 0})
                        </label>
                    ))}
                </div>
            </div>

            {/* Canvas */}
            <div
                ref={canvasRef}
                className={`erd-canvas ${isDragging ? 'dragging' : ''}`}
                style={{ 
                    transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                    transformOrigin: '0 0'
                }}
                onMouseDown={handleCanvasMouseDown}
                onMouseMove={handleCanvasMouseMove}
                onMouseUp={handleCanvasMouseUp}
                onMouseLeave={handleCanvasMouseLeave}
            >
                {/* Relationships - rendered first so they appear behind tables */}
                {renderRelationships()}

                {/* Tables */}
                {metadata.schemas.map(schema =>
                        visibleSchemas.has(schema.name) && schema.tables?.map(table => {
                            if (tables.length > 0 && !tables.includes(table.name)) return null;
                            return renderTable(table, schema.name);
                        })
                )}
            </div>

            {/* Zoom Level Indicator */}
            <div className="erd-zoom-level">
                {Math.round(zoom * 100)}%
            </div>

            {/* Search Bar */}
            <div className="erd-search-container">
                <input
                    type="text"
                    className="erd-search-input"
                    placeholder="Search tables and columns..."
                    value={searchQuery}
                    onChange={(e) => handleSearch(e.target.value)}
                />
                {searchResults.length > 0 && (
                    <div className="erd-search-results">
                        <div className="erd-search-results-header">
                            Found {searchResults.length} match{searchResults.length !== 1 ? 'es' : ''}
                        </div>
                        {(showAllResults ? searchResults : searchResults.slice(0, 5)).map((result) => (
                            <div 
                                key={result.key} 
                                className="erd-search-result-item"
                                onClick={() => handleSearchResultClick(result)}
                            >
                                <div className="erd-search-result-content">
                                    <div className="erd-search-result-schema">{result.schema}</div>
                                    <div className="erd-search-result-path">
                                        {result.type === 'table' 
                                            ? result.table
                                            : `${result.table}.${result.column}`
                                        }
                                    </div>
                                </div>
                                <span className="erd-search-result-similarity">
                                    {result.similarity}%
                                </span>
                            </div>
                        ))}
                        {searchResults.length > 5 && !showAllResults && (
                            <div 
                                className="erd-search-results-more"
                                onClick={() => setShowAllResults(true)}
                            >
                                +{searchResults.length - 5} more result{searchResults.length - 5 !== 1 ? 's' : ''}
                            </div>
                        )}
                        {showAllResults && searchResults.length > 5 && (
                            <div 
                                className="erd-search-results-more"
                                onClick={() => setShowAllResults(false)}
                            >
                                Show fewer results
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default ERDDiagram;