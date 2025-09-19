# EVE Online Reprocess King

A web-based utility for EVE Online players to quickly determine the profitability of reprocessing items based on Jita market prices. Paste your item list, and the tool will calculate the value of the reprocessed minerals against the item's market price.

## Features

- **Real-time Jita Price Integration**: Calculates profitability against either Jita buy or sell orders with fresh market data (≤24 hours old).
- **Flexible Input Parsing**: Accepts item lists copied directly from the EVE Online client including:
  - Cargo scans and container contents
  - Contract item lists
  - Industry window inventories
  - Simple item lists with quantities
- **Customizable Recovery Rate**:
  - Quick presets for common recovery rates (90.6% and 50%)
  - Custom reprocessing percentage input with real-time application
- **Advanced Tax Calculation**:
  - Configurable tax rate with percentage input
  - Flexible tax application: minerals only, item value only, or both
  - Accurate simulation of station fees and trading conditions
- **Powerful Filtering and Sorting**:
  - Toggle to ignore ammunition and other charges
  - Filter to show only items that are profitable to reprocess
  - Minimum profitability ratio filters with presets (≥1x, 2x, 5x, 10x) and custom values
  - Sort results by any column (item name, prices, difference, ratio, recommendation)
  - Bidirectional sorting (ascending/descending)
- **Detailed Material Breakdowns**:
  - Enhanced tooltip on "Reprocess Value" column shows detailed breakdown of reprocessed materials
  - Individual material quantities and current market values
  - Intelligent tooltip positioning that stays within screen boundaries
- **Comprehensive Totals Summary**: 
  - Footer row with combined values of all filtered items
  - Aggregated material breakdown in totals tooltip
- **Intelligent Ammunition Handling**: 
  - Automatic detection of batch-reprocessed charges (100 units at a time)
  - Special handling for items that reprocess individually
  - Proper support for Frequency Crystals (bypass batch reprocessing rules)
  - Smart detection using EVE SDE group and category data
- **Accurate Tooltip Value Normalization**: 
  - Corrects tooltip display values for special ammunition types:
    - **Bombs**: Values increased by 5x to reflect actual reprocessing yields
    - **Condensers**: Values reduced by 5x to show realistic mineral outputs  
    - **Triglavian Charges**: Values reduced by 50x for accurate expectations
    - **Scarab Breacher Pods**: Values increased by 5x to match in-game results
    - **Vorton Projector Charges**: Values reduced by 5x for proper display
- **Non-Reprocessable Item Support**: Displays all items including those that cannot be reprocessed

## How to Use

1. **Paste Items**: Copy a list of items from EVE Online and paste them into the text area.
2. **Select Market Side**: Click **Calculate (Buy Prices)** or **Calculate (Sell Prices)** to choose which Jita market orders to compare against.
3. **Set Recovery Rate**: 
   - Use preset buttons (90.6% or 50%) for quick selection
   - Enter a custom recovery percentage and click **Apply**
   - Recovery rate updates calculations in real-time
4. **Configure Filters**:
   - Toggle **Ignore Ammunition** to hide charges and consumables
   - Toggle **Show Only Reprocess** to display only profitable items
   - Set **Minimum Profitability Ratio** to filter by profitability threshold
5. **Configure Tax Settings**: 
   - Enter tax percentage in the Tax Rate field
   - Choose tax application: Minerals, Item Value, or Both
   - Tax settings immediately update all calculations
6. **Analyze Results**:
   - Review the sortable output table to identify profitable items
   - Hover over **Reprocess Value** for detailed material breakdowns
   - Click column headers to sort data ascending or descending
   - View totals in the footer row for aggregate analysis

## Step-by-Step Instructions

The interface provides clear numbered steps:

1. **Pick whether you want to use Jita Sell or Buy Prices**
2. **Select or enter your recovery rate for reprocessing**  
3. **Choose if you want to ignore consumables like Ammunition**
4. **Select profitability ratio of mineral value to item value**
5. **Enter the tax value of the station and choose application method**
6. **Hover over Reprocess Value to see detailed product breakdowns**

## Special Notes

- **Data Accuracy**: Uses the latest EVE SDE data with corrections for ammunition types with special reprocessing behaviors
- **Market Data Freshness**: All market prices are fetched from Jita with automatic validation (data must be ≤24 hours old)
- **Tax Simulation**: Tax calculations accurately simulate real station fees and trading conditions
- **Responsive Design**: Clean, modern interface optimized for desktop and mobile devices
- **Performance**: Real-time calculations with immediate updates when changing settings

## Technical Features

- **Fresh Market Data Validation**: Automatically ensures market data is current using HTTP headers
- **Intelligent Item Parsing**: Handles various EVE client formats including contract views and cargo scans  
- **Advanced Material Calculations**: Accounts for batch reprocessing, individual items, and special cases
- **SDE Data Integration**: Uses official EVE Static Data Export for accurate type, group, and material data
- **Real-time UI Updates**: All values recalculate instantly when modifying recovery rates, taxes, or filters
- **Accessibility Features**: ARIA labels and keyboard navigation support

## Supported Item Types

- **Standard Items**: Ships, modules, ammunition, materials
- **Special Ammunition**: Bombs, condensers, Triglavian charges, Vorton charges
- **Reprocessable Materials**: Ores, ice, salvage materials
- **Non-Reprocessable Items**: Displayed with appropriate indicators

## Disclaimer

Values are estimates and may vary between markets. Reprocessed products may have small variations due to rounding. If you notice significant discrepancies (2x, 5x, 10x differences), please contact **"Ziggarot Cadellane"** in-game for assistance.

---

*This tool serves as both a reprocessing calculator and a quick item appraisal utility that can be saved and accessed on any device.*
