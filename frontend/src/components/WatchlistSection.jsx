import React from "react";
import clsx from "clsx";

const WatchlistSection = ({ sectionStocks }) => {
  return (
    <div className="mb-6">
<div className="max-h-[500px] overflow-y-auto border rounded-lg shadow-sm">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50 sticky top-0 z-10">
            <tr>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Symbol</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Exchange</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">LTP</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Net Change</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">% Change</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Volume</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {sectionStocks.map((stock, idx) => (
              <tr key={idx} className="hover:bg-gray-100 transition-colors duration-200">
                <td className="px-4 py-2 font-semibold">{stock.symbol}</td>
                <td className="px-4 py-2">{stock.exchange}</td>
                <td className="px-4 py-2">{stock.ltp !== undefined ? stock.ltp : '-'}</td>
                <td className={clsx("px-4 py-2", stock.netChange > 0 ? "text-green-600" : stock.netChange < 0 ? "text-red-600" : "")}>{stock.netChange !== undefined ? stock.netChange.toFixed(2) : '-'}</td>
                <td className={clsx("px-4 py-2", stock.percentChange > 0 ? "text-green-600" : stock.percentChange < 0 ? "text-red-600" : "")}>{stock.percentChange !== undefined ? stock.percentChange.toFixed(2) + '%' : '-'}</td>
                <td className="px-4 py-2">{stock.volume !== undefined ? stock.volume.toLocaleString() : '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default WatchlistSection;
