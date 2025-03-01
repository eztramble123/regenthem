import React from "react";
import Image from "next/image";
import { Progress } from "./ui/progress";
import { Button } from "./ui/button";
import type { FundData } from "../utils/fundDataFetcher";

interface FundCardProps {
  fund: FundData;
  onSupportClick: (fund: FundData) => void;
}

export default function FundCard({ fund, onSupportClick }: FundCardProps) {
  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 p-4 hover:shadow-lg transition-all duration-300 bg-white dark:bg-gray-800">
      <div className="relative">
        <Image
          src={fund.image}
          alt={fund.name}
          width={400}
          height={200}
          className="w-full h-48 object-cover rounded-lg mb-3"
        />
        <div className="absolute top-2 right-2 bg-green-100 text-green-800 text-xs font-medium px-2.5 py-0.5 rounded-full">
          Active
        </div>
      </div>
      <h3 className="font-semibold text-lg mb-1">{fund.name}</h3>
      <p className="text-sm text-gray-600 dark:text-gray-400 mb-4 line-clamp-2 h-10">
        {fund.description}
      </p>
      <Progress
        value={fund.progress}
        className="h-2.5 mb-2 bg-gray-200 dark:bg-gray-700"
      />
      <div className="flex justify-between items-center">
        <p className="text-xs text-gray-500 dark:text-gray-400">
          ${fund.currentBalance.toLocaleString()} raised
        </p>
        <p className="text-xs font-medium text-green-600 dark:text-green-400">
          ${fund.goal.toLocaleString()} goal
        </p>
      </div>
      <div className="flex items-center justify-end mt-1">
        <div className="animate-pulse mr-1 w-1.5 h-1.5 rounded-full bg-green-500"></div>
        <span className="text-xs text-gray-500">Live updates</span>
      </div>
      <Button
        onClick={() => onSupportClick(fund)}
        className="w-full mt-4 bg-green-500 hover:bg-green-600 text-white rounded-full text-sm py-1"
      >
        Support
      </Button>
    </div>
  );
}
