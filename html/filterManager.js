import { api } from './api.js';
import { filterService } from './filterService.js';

export class FilterManager {
    constructor({header, plots, data}) {
        this.plots = plots;
        this.data = data;
        this.targetPlotIndex = 1; // Hardcoded to second plot
        this.presets = new Map(); // Store presets in memory
        this.setupUI(header);
        this.setupElements();
        this.appliedFilter = {'lb': 0, 'ub': 0};
        this.setupCallbacks();
        this.loadPresetsFromServer();
    }

    setupUI(header) {
        this.filterDiv = header.append("div")
            .attr("class", "filter-controls d-flex align-items-center gap-2 mt-2");

        // Filter controls group
        const filterControls = this.filterDiv.append("div")
            .attr("class", "d-flex align-items-center gap-2");

        // Lower bound controls
        filterControls.append("div")
            .attr("class", "form-check")
            .append("input")
            .attr("class", "form-check-input filter-paramater")
            .attr("type", "checkbox")
            .attr("id", "enableLowerBound");

        filterControls.append("input")
            .attr("type", "number")
            .attr("class", "form-control form-control-sm filter-paramater")
            .attr("placeholder", "Lower bound")
            .attr("id", "lowerBoundInput")
            .attr("style", "width: 120px");

        // Upper bound controls
        filterControls.append("div")
            .attr("class", "form-check")
            .append("input")
            .attr("class", "form-check-input filter-paramater")
            .attr("type", "checkbox")
            .attr("id", "enableUpperBound");

        filterControls.append("input")
            .attr("type", "number")
            .attr("class", "form-control form-control-sm filter-paramater")
            .attr("placeholder", "Upper bound")
            .attr("id", "upperBoundInput")
            .attr("style", "width: 120px");

        // Apply button
        filterControls.append("button")
            .attr("class", "btn btn-primary btn-sm")
            .attr("id", "applyFilter")
            .text("Apply Filter")
            .attr("disabled", true);

        // Preset controls group with label
        const presetControls = this.filterDiv.append("div")
            .attr("class", "d-flex align-items-center gap-2 ms-4");

        presetControls.append("span")
            .attr("class", "me-2")
            .text("Presets:");

        // Preset name input
        presetControls.append("input")
            .attr("type", "text")
            .attr("class", "form-control form-control-sm")
            .attr("id", "presetName")
            .attr("placeholder", "Preset name")
            .attr("style", "width: 150px");

        // Preset dropdown
        presetControls.append("select")
            .attr("class", "form-select form-select-sm")
            .attr("style", "width: 150px");

        // Save preset button
        presetControls.append("button")
            .attr("class", "btn btn-outline-secondary btn-sm")
            .text("Save Preset");
    }

    setupElements() {
        this.elements = {
            lowerBound: document.getElementById('lowerBoundInput'),
            upperBound: document.getElementById('upperBoundInput'),
            enableLowerBound: document.getElementById('enableLowerBound'),
            enableUpperBound: document.getElementById('enableUpperBound'),
            applyButton: document.getElementById('applyFilter'),
            presetName: document.getElementById('presetName')
        };
    }

    setupCallbacks() {
        this.elements.applyButton.addEventListener('click', () => this.applyFilter());

        // Save preset button callback
        const saveButton = this.filterDiv.select('button:last-child').node();
        saveButton.addEventListener('click', () => this.savePreset());

        // Preset dropdown callback
        const presetDropdown = this.filterDiv.select('select').node();
        presetDropdown.addEventListener('change', () => this.loadPreset());

        // disable Apply button when filter is unchanged
        const filterInputs = this.filterDiv.selectAll('.filter-paramater').nodes();
        filterInputs.forEach(input => {
            input.addEventListener('input', () => {

                const lbEnabled = this.elements.enableLowerBound.checked;
                const lbValue = (lbEnabled ? parseFloat(this.elements.lowerBound.value) : 0) || 0;
                
                const ubEnabled = this.elements.enableUpperBound.checked;  
                const ubValue = (ubEnabled ? parseFloat(this.elements.upperBound.value) : 0) || 0;

                const currentSelection = {
                    'lb': lbValue,
                    'ub': ubValue
                };

                this.elements.applyButton.disabled = JSON.stringify(this.appliedFilter) === JSON.stringify(currentSelection);
            });
        });

    }

    async loadPresetsFromServer() {
        try {
            const presets = await api.getFilterPresets();
            presets.forEach(preset => {
                this.presets.set(preset.name, preset);
                this.registerFilterWithService(preset);
            });
            this.updatePresetDropdown();
        } catch (error) {
            console.error('Failed to load presets:', error);
        }
    }

    registerFilterWithService(preset) {
        const filterName = `filterManagerFilter_${preset.name}`;
        if (!filterService.hasFilter(filterName)) {
            filterService.addFilter(filterName, {
                type: preset.lb > 0 && preset.ub > 0 ? 'bandpass' :
                      preset.lb > 0 ? 'highpass' : 'lowpass',
                order: 3,
                characteristic: 'butterworth',
                Fs: 1395,
                Fc: preset.ub || preset.lb || 20,
                BW: preset.ub && preset.lb ? preset.ub - preset.lb : 1,
                gain: 0,
                preGain: false
            });
        }
    }

    async savePreset() {
        const presetName = this.elements.presetName.value;
        if (!presetName) return;

        const lb = parseFloat(this.elements.lowerBound.value) || 0;
        const ub = parseFloat(this.elements.upperBound.value) || 0;

        // Validate bounds
        if (lb < 0 || lb > 1395/2 || ub < 0 || ub > 1395/2) {
            alert('Bounds must be between 0 and ' + (1395/2));
            return;
        }

        const preset = { name: presetName, lb, ub };
        this.presets.set(presetName, preset);
        this.registerFilterWithService(preset);
        
        try {
            await api.saveFilterPresets(Array.from(this.presets.values()));
            this.updatePresetDropdown();
        } catch (error) {
            console.error('Failed to save presets:', error);
        }
    }

    loadPreset() {
        const presetDropdown = this.filterDiv.select('select').node();
        const selectedPreset = this.presets.get(presetDropdown.value);
        
        if (!selectedPreset) return;

        // Set values and checkboxes based on preset
        this.elements.lowerBound.value = selectedPreset.lb || '';
        this.elements.upperBound.value = selectedPreset.ub || '';
        this.elements.enableLowerBound.checked = selectedPreset.lb > 0;
        this.elements.enableUpperBound.checked = selectedPreset.ub > 0;
    }

    applyFilter() {
        const lbEnabled = this.elements.enableLowerBound.checked;
        const ubEnabled = this.elements.enableUpperBound.checked;
        const lb = lbEnabled ? parseFloat(this.elements.lowerBound.value) || 0 : 0;
        const ub = ubEnabled ? parseFloat(this.elements.upperBound.value) || 0 : 0;
        
        const container = this.data.getContainer('signal');        
        let updatedData = container['signal'];
        if (lb != 0 || ub != 0) {
            // Validate bounds before proceeding
            if ((lbEnabled && (lb < 0 || lb > 1395/2)) || (ubEnabled && (ub < 0 || ub > 1395/2))) {
                alert('Bounds must be between 0 and ' + (1395/2));
                return;
            }

            // Create temporary filter name based on current settings
            const filterName = `filterManagerFilter_temp_${lb}_${ub}`;

            // Only create/update filter if it doesn't exist
            if (!filterService.hasFilter(filterName)) {
                filterService.addFilter(filterName, {
                    type: lbEnabled && ubEnabled ? 'bandpass' :
                            lbEnabled ? 'highpass' : 'lowpass',
                    order: 3,
                    characteristic: 'butterworth',
                    Fs: 1395,
                    Fc: ubEnabled ? ub : lb,
                    BW: lbEnabled && ubEnabled ? ub - lb : 1,
                    gain: 0,
                    preGain: false
                });
            }

            updatedData = filterService.filterSignal(updatedData, filterName);
        }

        container['signalFiltered'] = updatedData;
        this.plots[this.targetPlotIndex].lines.forEach(line => {
            line.lttbData = null;
        });
        this.plots[this.targetPlotIndex].update();
        this.appliedFilter = {lb, ub};
        this.elements.applyButton.disabled = true;
    }

    updatePresetDropdown() {
        const dropdown = this.filterDiv.select('select');
        dropdown.selectAll('option').remove();
        
        dropdown.append('option')
            .attr('value', '')
            .text('Select a preset');

        for (const [name] of this.presets) {
            dropdown.append('option')
                .attr('value', name)
                .text(name);
        }
    }
}