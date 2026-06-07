"use client";

import React, { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { ChevronDown, Check } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface DropdownOption {
  value: string;
  label: string;
}

interface DropdownProps {
  options: (string | DropdownOption)[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  buttonClassName?: string;
}

interface DropdownItemProps {
  option: DropdownOption;
  isSelected: boolean;
  onSelect: (value: string) => void;
}

const DropdownItem = React.memo(function DropdownItem({
  option,
  isSelected,
  onSelect,
}: DropdownItemProps) {
  const handleItemClick = useCallback(() => {
    onSelect(option.value);
  }, [option.value, onSelect]);

  return (
    <button
      type="button"
      onClick={handleItemClick}
      className={`w-full flex items-center justify-between px-4 py-3 text-sm transition-colors hover:bg-primary/10 group ${
        isSelected ? "bg-primary/5 text-primary" : "text-gray-300"
      }`}
    >
      <span>{option.label}</span>
      {isSelected && (
        <Check className="w-4 h-4 text-primary" />
      )}
    </button>
  );
});

export const Dropdown = React.memo(function Dropdown({
  options,
  value,
  onChange,
  placeholder = "Select an option",
  disabled = false,
  className = "",
  buttonClassName = "",
}: DropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const normalizedOptions: DropdownOption[] = useMemo(() => {
    return options.map((opt) =>
      typeof opt === "string" ? { value: opt, label: opt } : opt
    );
  }, [options]);

  const selectedOption = useMemo(() => {
    return normalizedOptions.find((opt) => opt.value === value);
  }, [normalizedOptions, value]);

  const toggleOpen = useCallback(() => {
    setIsOpen((prev) => !prev);
  }, []);

  const handleSelect = useCallback((val: string) => {
    onChange(val);
    setIsOpen(false);
  }, [onChange]);

  return (
    <div className={`relative ${className}`} ref={containerRef}>
      <button
        type="button"
        disabled={disabled}
        onClick={toggleOpen}
        className={`w-full flex items-center justify-between bg-background/50 border border-white/10 rounded-xl py-3 pl-4 pr-10 text-left text-white focus:outline-none focus:border-primary transition-all cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 ${buttonClassName}`}
      >
        <span className={!selectedOption ? "text-gray-500" : ""}>
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-gray-500">
          <motion.div
            animate={{ rotate: isOpen ? 180 : 0 }}
            transition={{ duration: 0.2 }}
          >
            <ChevronDown className="w-5 h-5" />
          </motion.div>
        </div>
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.95 }}
            animate={{ opacity: 1, y: 5, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="absolute z-[100] w-full mt-2 py-2 bg-[#0f172a]/95 border border-white/10 rounded-2xl shadow-2xl backdrop-blur-xl overflow-hidden"
          >
            <div className="max-h-60 overflow-y-auto custom-scrollbar">
              {normalizedOptions.map((option) => (
                <DropdownItem
                  key={option.value}
                  option={option}
                  isSelected={option.value === value}
                  onSelect={handleSelect}
                />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
});

export default Dropdown;
