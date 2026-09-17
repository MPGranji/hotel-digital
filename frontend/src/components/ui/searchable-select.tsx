"use client";

import { ChevronDown, Search } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

export interface SearchableSelectOption {
  value: string;
  label: string;
  inputValue?: string;
  searchText?: string;
  disabled?: boolean;
}

interface SearchableSelectProps {
  id: string;
  value: string;
  options: SearchableSelectOption[];
  onChange: (value: string) => void;
  placeholder: string;
  searchPlaceholder?: string;
  emptyText?: string;
  disabled?: boolean;
  searchValue?: string;
  onSearchChange?: (value: string) => void;
}

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("vi-VN")
    .trim();
}

export function SearchableSelect({
  id,
  value,
  options,
  onChange,
  placeholder,
  searchPlaceholder = "Nhập để tìm…",
  emptyText = "Không có kết quả phù hợp.",
  disabled,
  searchValue,
  onSearchChange,
}: Readonly<SearchableSelectProps>) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [internalSearch, setInternalSearch] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const selectedOption = options.find((option) => option.value === value);
  const query = searchValue ?? (!open && selectedOption ? selectedOption.label : internalSearch);

  const visibleOptions = useMemo(() => {
    const normalizedQuery = normalize(query);
    if (!normalizedQuery || selectedOption?.label === query) return options;
    return options.filter((option) => normalize(`${option.label} ${option.searchText ?? ""}`).includes(normalizedQuery));
  }, [options, query, selectedOption?.label]);

  useEffect(() => {
    function closeWhenClickingOutside(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }

    document.addEventListener("mousedown", closeWhenClickingOutside);
    return () => document.removeEventListener("mousedown", closeWhenClickingOutside);
  }, []);

  function changeSearch(nextSearch: string) {
    if (onSearchChange) onSearchChange(nextSearch);
    else setInternalSearch(nextSearch);

    if (value && nextSearch !== selectedOption?.label) onChange("");
    setActiveIndex(0);
    setOpen(true);
  }

  function choose(option: SearchableSelectOption) {
    if (option.disabled) return;
    onChange(option.value);
    const nextSearch = option.inputValue ?? option.label;
    if (onSearchChange) onSearchChange(nextSearch);
    else setInternalSearch(nextSearch);
    setOpen(false);
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") {
      setOpen(false);
      return;
    }

    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      setOpen(true);
      const direction = event.key === "ArrowDown" ? 1 : -1;
      setActiveIndex((current) => Math.min(Math.max(current + direction, 0), visibleOptions.length - 1));
      return;
    }

    if (event.key === "Enter" && open && visibleOptions[activeIndex]) {
      event.preventDefault();
      choose(visibleOptions[activeIndex]);
    }
  }

  return (
    <div className="relative" ref={rootRef}>
      <Search aria-hidden className="pointer-events-none absolute left-3 top-3 z-10 size-4 text-slate-400" />
      <input
        aria-autocomplete="list"
        aria-controls={`${id}-options`}
        aria-expanded={open}
        autoComplete="off"
        className="min-h-10 w-full rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-9 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-blue-500 focus:outline focus:outline-2 focus:outline-blue-200"
        disabled={disabled}
        id={id}
        onChange={(event) => changeSearch(event.target.value)}
        onFocus={() => {
          if (searchValue === undefined && selectedOption) setInternalSearch(selectedOption.inputValue ?? selectedOption.label);
          setOpen(true);
        }}
        onKeyDown={handleKeyDown}
        placeholder={value ? placeholder : searchPlaceholder}
        role="combobox"
        value={query}
      />
      <ChevronDown aria-hidden className="pointer-events-none absolute right-3 top-3 size-4 text-slate-400" />

      {open && !disabled ? (
        <div className="absolute z-30 mt-1 max-h-56 w-full overflow-y-auto rounded-lg border border-slate-200 bg-white py-1 shadow-lg" id={`${id}-options`} role="listbox">
          {visibleOptions.length === 0 ? (
            <p className="px-3 py-3 text-sm text-slate-500">{emptyText}</p>
          ) : visibleOptions.map((option, index) => (
            <button
              aria-selected={option.value === value}
              className={`block w-full px-3 py-2 text-left text-sm ${index === activeIndex ? "bg-blue-50" : "bg-white"} ${option.value === value ? "font-semibold text-blue-800" : "text-slate-700"} disabled:text-slate-400`}
              disabled={option.disabled}
              key={option.value}
              onMouseDown={(event) => event.preventDefault()}
              onMouseEnter={() => setActiveIndex(index)}
              onClick={() => choose(option)}
              role="option"
              type="button"
            >
              {option.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
