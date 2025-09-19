# EVE Online Reprocess King

A web-based utility for EVE Online players to quickly determine the profitability of reprocessing items based on Jita market prices. Paste your item list, and the tool will calculate the value of the reprocessed minerals against the item's market price.

## Features

- **Jita Price Integration**: Calculates profitability against either Jita buy or sell orders.
- **Flexible Input Parsing**: Accepts item lists copied directly from the EVE Online client (e.g., cargo scans, contracts, industry windows).
- **Customizable Recovery Rate**:
    - Presets for common recovery rates (90.6% and 50%).
    - Option to enter a custom reprocessing percentage.
- **Advanced Tax Calculation**:
    - Set a custom tax rate.
    - Apply taxes to reduce the mineral value, the item's market value, or both.
- **Powerful Filtering and Sorting**:
    - Toggle to ignore ammunition and other charges.
    - Filter to show only items that are profitable to reprocess.
    - Filter by a minimum profitability ratio with presets (≥ 1x, 2x, 5x, 10x) or a custom value.
    - Sort results by any column in the output table.
- **Detailed Breakdowns**:
    - An enhanced tooltip on the "Reprocess Value" column shows a detailed breakdown of the reprocessed materials and their current market value.
    - The tooltip intelligently repositions itself to stay within the screen boundaries.
- **Totals Summary**: The output table includes a "Total" row summarizing the combined value of all filtered items.
- **Smart Ammunition Handling**: 
    - Automatically detects batch-reprocessed charges (100 units at a time) vs. individual items.
    - Special handling for Triglavian charges that reprocess individually despite being ammunition.
    - Proper support for Frequency Crystals that don't follow standard batch reprocessing rules.
- **Accurate Tooltip Normalization**: 
    - Corrects tooltip display values for special ammunition types:
        - **Bombs**: Values increased by 5x to reflect actual reprocessing yields
        - **Condensers**: Values reduced by 5x to show realistic mineral outputs
        - **Triglavian Charges**: Values reduced by 50x for accurate expectations
        - **Scarab Breacher Pods**: Values increased by 5x to match in-game results
        - **Vorton Projector Charges**: Values reduced by 5x for proper display

## How to Use

1.  **Paste Items**: Copy a list of items from EVE Online and paste them into the text area.
2.  **Select Market Side**: Click **Calculate (Buy Prices)** or **Calculate (Sell Prices)** to choose which market orders to compare against.
3.  **Set Recovery Rate**: Use the preset buttons or enter a custom recovery percentage and click **Apply**.
4.  **Configure Filters**:
    - Toggle **Ignore Ammunition** or **Show Only Reprocess** on or off.
    - Select a **Minimum Profitability Ratio** to hide items that don't meet your threshold.
5.  **Set Tax Rate**: Enter a tax percentage and choose whether to apply it to the minerals, the item value, or both. Taxes reduce the effective value to reflect real station fees.
6.  **Analyze Results**:
    - Review the output table to see which items are profitable.
    - Hover over the **Reprocess Value** for any item to see a detailed breakdown of the resulting minerals.
    - Click on column headers to sort the data.

## Special Notes

- **Data Accuracy**: The tool uses the latest EVE SDE data and applies corrections for ammunition types that have special reprocessing behaviors.
- **Market Data**: All market prices are fetched from Jita and are updated in real-time (data must be less than 24 hours old).
- **Tax Handling**: Tax calculations properly reduce values to simulate real station fees and trading conditions.
- **Disclaimer**: Values are estimates and may vary between markets. Reprocessed products may have small variations due to rounding. If you notice significant discrepancies (2x, 5x, 10x differences), please contact "Ziggarot Cadellane" in-game for assistance.

## Technical Features

- **Fresh Market Data**: Automatically validates that market data is less than 24 hours old
- **Intelligent Parsing**: Handles various EVE item list formats including contract views and cargo scans
- **Responsive UI**: Clean, modern interface that works across different screen sizes
- **Real-time Calculations**: All values update instantly when changing recovery rates, taxes, or filters
