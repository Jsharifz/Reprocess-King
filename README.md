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
    - Apply taxes to the mineral value, the item's market value, or both.
- **Powerful Filtering and Sorting**:
    - Toggle to ignore ammunition and other charges.
    - Filter to show only items that are profitable to reprocess.
    - Filter by a minimum profitability ratio with presets (≥ 1x, 2x, 5x, 10x) or a custom value.
    - Sort results by any column in the output table.
- **Detailed Breakdowns**:
    - An enhanced tooltip on the "Reprocess Value" column shows a detailed breakdown of the reprocessed materials and their current market value.
    - The tooltip intelligently repositions itself to stay within the screen boundaries.
- **Totals Summary**: The output table includes a "Total" row summarizing the combined value of all filtered items.

## How to Use

1.  **Paste Items**: Copy a list of items from EVE Online and paste them into the text area.
2.  **Select Market Side**: Click **Calculate (Buy Prices)** or **Calculate (Sell Prices)** to choose which market orders to compare against.
3.  **Set Recovery Rate**: Use the preset buttons or enter a custom recovery percentage and click **Apply**.
4.  **Configure Filters**:
    - Toggle **Ignore Ammunition** or **Show Only Reprocess** on or off.
    - Select a **Minimum Profitability Ratio** to hide items that don't meet your threshold.
5.  **Set Tax Rate**: Enter a tax percentage and choose whether to apply it to the minerals, the item, or both.
6.  **Analyze Results**:
    - Review the output table to see which items are profitable.
    - Hover over the **Reprocess Value** for any item to see a detailed breakdown of the resulting minerals.
    - Click on column headers to sort the data.
