// Global variables
        let scanData = [];
        let filteredData = [];
        let currentPage = 1;
        const itemsPerPage = 12;
        
        // DOM elements
        const loadFileBtn = document.getElementById('loadFileBtn');
        const fileInput = document.getElementById('fileInput');
        const reloadBtn = document.getElementById('reloadBtn');
        const statusDiv = document.getElementById('status');
        const ipFilter = document.getElementById('ipFilter');
        const portFilter = document.getElementById('portFilter');
        const httpFilter = document.getElementById('httpFilter');
        const grid = document.getElementById('grid');
        const pagination = document.getElementById('pagination');
        
        // Event listeners
        loadFileBtn.addEventListener('click', () => fileInput.click());
        fileInput.addEventListener('change', handleFileUpload);
        reloadBtn.addEventListener('click', reloadData);
        ipFilter.addEventListener('input', applyFilters);
        portFilter.addEventListener('input', applyFilters);
        httpFilter.addEventListener('input', applyFilters);
        
        // Functions
        function handleFileUpload(event) {
            const file = event.target.files[0];
            if (!file) return;
            
            const reader = new FileReader();
            reader.onload = function(e) {
                try {
                    const content = e.target.result;
                    parseScanData(content);
                    showStatus('File loaded successfully!', 'success');
                    reloadBtn.disabled = false;
                } catch (error) {
                    showStatus('Error parsing file: ' + error.message, 'error');
                    console.error(error);
                }
            };
            reader.readAsText(file);
        }
        
        function parseScanData(content) {
            const lines = content.split('\n');
            scanData = [];
            
            // Find the line with the header to determine column positions
            let headerIndex = -1;
            for (let i = 0; i < lines.length; i++) {
                if (lines[i].includes('IP') && lines[i].includes('Ping') && lines[i].includes('Hostname') && lines[i].includes('Ports')) {
                    headerIndex = i;
                    break;
                }
            }
            
            if (headerIndex === -1) {
                throw new Error('Invalid file format - header not found');
            }
            
            // Process data lines
            for (let i = headerIndex + 1; i < lines.length; i++) {
                const line = lines[i].trim();
                if (!line) continue;
                
                // Split by multiple spaces
                const parts = line.split(/\s+/).filter(part => part.trim() !== '');
                
                if (parts.length < 4) continue;
                
                const ip = parts[0];
                const ping = parts[1];
                const hostname = parts[2] === '[n/a]' ? null : parts[2];
                let ports = parts[3];
                
                // Handle cases where ports might be merged with other columns
                if (parts.length > 4) {
                    for (let j = 4; j < parts.length; j++) {
                        ports += ',' + parts[j];
                    }
                }
                
                // Clean up ports
                ports = ports.split(',').map(port => {
                    // Remove non-numeric characters
                    const cleanPort = port.replace(/\D/g, '');
                    return cleanPort ? parseInt(cleanPort) : null;
                }).filter(port => port !== null);
                
                scanData.push({
                    ip,
                    ping,
                    hostname,
                    ports
                });
            }
            
            // Store the parsed data in localStorage for reloading
            localStorage.setItem('ipScanData', JSON.stringify(scanData));
            
            applyFilters();
        }
        
        function reloadData() {
            const savedData = localStorage.getItem('ipScanData');
            if (savedData) {
                try {
                    scanData = JSON.parse(savedData);
                    applyFilters();
                    showStatus('Data reloaded successfully!', 'success');
                } catch (error) {
                    showStatus('Error reloading data: ' + error.message, 'error');
                }
            } else {
                showStatus('No saved data found', 'error');
            }
        }
        
        function applyFilters() {
            const ipFilterValue = ipFilter.value.toLowerCase();
            const portFilterValue = portFilter.value;
            const httpFilterValue = httpFilter.value;
            
            filteredData = scanData.filter(item => {
                // IP filter
                if (ipFilterValue && !item.ip.toLowerCase().includes(ipFilterValue)) {
                    return false;
                }
                
                // Port filter
                if (portFilterValue) {
                    const portFound = item.ports.some(port => port.toString().includes(portFilterValue));
                    if (!portFound) return false;
                }
                
                // HTTP/HTTPS filter
                if (httpFilterValue !== 'all') {
                    const hasHttp = item.ports.includes(80);
                    const hasHttps = item.ports.includes(443);
                    
                    if (httpFilterValue === 'http' && !hasHttp) return false;
                    if (httpFilterValue === 'https' && !hasHttps) return false;
                }
                
                return true;
            });
            
            currentPage = 1;
            renderGrid();
            renderPagination();
        }
        
        function renderGrid() {
            grid.innerHTML = '';
            
            if (filteredData.length === 0) {
                grid.innerHTML = '<div style="grid-column: 1 / -1; text-align: center; padding: 40px; color: #5f6368;">No devices found matching your filters</div>';
                pagination.innerHTML = '';
                return;
            }
            
            const startIndex = (currentPage - 1) * itemsPerPage;
            const endIndex = Math.min(startIndex + itemsPerPage, filteredData.length);
            const pageData = filteredData.slice(startIndex, endIndex);
            
            pageData.forEach(item => {
                const card = document.createElement('div');
                card.className = 'card';
                
                // Determine primary protocol
                const hasHttp = item.ports.includes(80);
                const hasHttps = item.ports.includes(443);
                const primaryProtocol = hasHttps ? 'https' : hasHttp ? 'http' : null;
                const primaryPort = hasHttps ? 443 : hasHttp ? 80 : item.ports[0];
                
                card.innerHTML = `
                    <div class="card-header">
                        <div class="card-title">${item.ip}</div>
                        <div class="card-badge">${item.ping}</div>
                    </div>
                    <div class="card-body">
                        <div class="card-info">
                            <span class="card-info-label">Hostname:</span>
                            <span>${item.hostname || 'N/A'}</span>
                        </div>
                        <div class="card-info">
                            <span class="card-info-label">Ports:</span>
                            <span>${item.ports.join(', ')}</span>
                        </div>
                        
                        <div class="iframe-container" id="iframe-${item.ip.replace(/\./g, '-')}">
                            ${primaryProtocol ? `
                                <iframe src="${primaryProtocol}://${item.ip}:${primaryPort}" frameborder="0" loading="lazy"></iframe>
                                <div class="loading">
                                    <div class="spinner"></div>
                                </div>
                            ` : `
                                <div class="iframe-placeholder">
                                    No HTTP/HTTPS port available
                                </div>
                            `}
                        </div>
                    </div>
                `;
                
                grid.appendChild(card);
                
                // Add event listener to hide loading spinner when iframe loads
                if (primaryProtocol) {
                    const iframeContainer = card.querySelector('.iframe-container');
                    const iframe = iframeContainer.querySelector('iframe');
                    const loading = iframeContainer.querySelector('.loading');
                    
                    iframe.addEventListener('load', () => {
                        loading.style.display = 'none';
                    });
                    
                    // Also hide loading after timeout in case iframe fails to load
                    setTimeout(() => {
                        loading.style.display = 'none';
                    }, 10000);
                }
            });
        }
        
        function renderPagination() {
            pagination.innerHTML = '';
            
            const totalPages = Math.ceil(filteredData.length / itemsPerPage);
            if (totalPages <= 1) return;
            
            // Previous button
            const prevBtn = document.createElement('button');
            prevBtn.className = 'btn btn-secondary page-btn';
            prevBtn.innerHTML = '&laquo;';
            prevBtn.disabled = currentPage === 1;
            prevBtn.addEventListener('click', () => {
                if (currentPage > 1) {
                    currentPage--;
                    renderGrid();
                    renderPagination();
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                }
            });
            pagination.appendChild(prevBtn);
            
            // Page buttons
            const maxVisiblePages = 5;
            let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
            let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);
            
            if (endPage - startPage + 1 < maxVisiblePages) {
                startPage = Math.max(1, endPage - maxVisiblePages + 1);
            }
            
            if (startPage > 1) {
                const firstBtn = document.createElement('button');
                firstBtn.className = 'btn btn-secondary page-btn';
                firstBtn.textContent = '1';
                firstBtn.addEventListener('click', () => {
                    currentPage = 1;
                    renderGrid();
                    renderPagination();
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                });
                pagination.appendChild(firstBtn);
                
                if (startPage > 2) {
                    const ellipsis = document.createElement('span');
                    ellipsis.className = 'page-ellipsis';
                    ellipsis.textContent = '...';
                    pagination.appendChild(ellipsis);
                }
            }
            
            for (let i = startPage; i <= endPage; i++) {
                const pageBtn = document.createElement('button');
                pageBtn.className = `btn ${i === currentPage ? 'btn-primary active' : 'btn-secondary'} page-btn`;
                pageBtn.textContent = i;
                pageBtn.addEventListener('click', () => {
                    currentPage = i;
                    renderGrid();
                    renderPagination();
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                });
                pagination.appendChild(pageBtn);
            }
            
            if (endPage < totalPages) {
                if (endPage < totalPages - 1) {
                    const ellipsis = document.createElement('span');
                    ellipsis.className = 'page-ellipsis';
                    ellipsis.textContent = '...';
                    pagination.appendChild(ellipsis);
                }
                
                const lastBtn = document.createElement('button');
                lastBtn.className = 'btn btn-secondary page-btn';
                lastBtn.textContent = totalPages;
                lastBtn.addEventListener('click', () => {
                    currentPage = totalPages;
                    renderGrid();
                    renderPagination();
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                });
                pagination.appendChild(lastBtn);
            }
            
            // Next button
            const nextBtn = document.createElement('button');
            nextBtn.className = 'btn btn-secondary page-btn';
            nextBtn.innerHTML = '&raquo;';
            nextBtn.disabled = currentPage === totalPages;
            nextBtn.addEventListener('click', () => {
                if (currentPage < totalPages) {
                    currentPage++;
                    renderGrid();
                    renderPagination();
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                }
            });
            pagination.appendChild(nextBtn);
        }
        
        function showStatus(message, type) {
            statusDiv.textContent = message;
            statusDiv.className = `status ${type}`;
            
            // Hide status after 5 seconds
            setTimeout(() => {
                statusDiv.style.opacity = '0';
                setTimeout(() => {
                    statusDiv.className = 'status';
                    statusDiv.style.opacity = '1';
                }, 500);
            }, 5000);
        }
        
        // Check for saved data on page load
        document.addEventListener('DOMContentLoaded', () => {
            const savedData = localStorage.getItem('ipScanData');
            if (savedData) {
                try {
                    scanData = JSON.parse(savedData);
                    filteredData = [...scanData];
                    reloadBtn.disabled = false;
                    renderGrid();
                    renderPagination();
                } catch (error) {
                    console.error('Error loading saved data:', error);
                }
            }
        });