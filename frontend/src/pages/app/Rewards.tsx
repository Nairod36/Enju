import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import React from "react";

export default function Rewards() {
  return (
    <div className="w-full px-10 pb-12">
      <div className="mx-0 lg:mx-10 h-fulll">
        <div className=" flex flex-wrap gap-5 h-full">
          <div className="container mx-auto px-4 h-full pt-5">
            {/* <Breadcrumb/> */}
            <div className="mt-10 flex flex-row gap-x-5 h-full w-full">
              {/* Left */}
              <div className="w-3/5">
                <div className=" w-full flex flex-col gap-y-5 p-2">
                  <div className="h-full w-full">
                    <div className="object-cover w-52 h-100 md:w-114 md:h-114 lg:w-64 lg:h-64 ml-2 xl:ml-24 rounded-lg ">
                      <img
                        alt="content"
                        className="object-cover w-100 h-100 md:w-114 md:h-114 lg:w-64 lg:h-64 ml-2 xl:ml-24 rounded-lg"
                        src={
                          "https://sothebys-com.brightspotcdn.com/dims4/default/441c499/2147483647/strip/true/crop/1080x1080+0+0/resize/684x684!/format/webp/quality/90/?url=http%3A%2F%2Fsothebys-brightspot.s3.amazonaws.com%2Fdotcom%2Fab%2Fa5%2F80c8e82e4d9ea9412f20b9e92988%2Fgif-fungibleopeneditions-small.gif"
                        }
                      />
                      {/* <div className="w-100 h-100 md:w-114 md:h-114 lg:w-114 lg:h-114 ml-2 xl:ml-24 rounded-lg">
                        <Cube id={parseInt(params.id ?? "0")} />
                      </div> */}
                    </div>
                  </div>

                  <div className="h-full w-full mt-5">
                    <h3 className="text-2xl font-medium text-neutral mb-5">
                      "description"
                    </h3>

                    <p
                      className="text-gray-500 text-base font-medium pr-10 w-5/6 overflow-x-auto overflow-y-auto"
                      style={{ maxHeight: "200px" }}
                    >
                      Lorem ipsum dolor sit amet consectetur adipisicing elit.
                      Distinctio vero, nisi laudantium quas voluptatibus autem
                      et deleniti ullam eligendi sapiente recusandae ipsum,
                      accusamus ut consequatur mollitia incidunt, ea aperiam
                      excepturi?
                    </p>
                  </div>

                  <div className="h-full w-full">
                    <h3 className="text-2xl font-medium text-neutral mt-7 mb-7">
                      Historical
                    </h3>
                    <div
                      className="overflow-x-auto overflow-y-auto w-5/6"
                      style={{ maxHeight: "300px" }}
                    >
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>From</TableHead>
                            <TableHead>Date/Time</TableHead>
                            <TableHead>To</TableHead>
                            <TableHead>Amount</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {/* {Historical.map((transaction, i) => (
                            <TableRow key={i}>
                              <TableCell>
                                <Link
                                  to={`https://sepolia.etherscan.io/tx/${transaction.transactionHash}`}
                                >
                                  from:{" "}
                                  <span className="font-medium">
                                    {shortenAddress(transaction.from)}
                                  </span>
                                </Link>
                              </TableCell>
                              <TableCell>
                                {formatDateTime(transaction.timestamp)}
                              </TableCell>
                              <TableCell>
                                to:{" "}
                                <span className="font-medium">
                                  {shortenAddress(transaction.to)}
                                </span>
                              </TableCell>
                              <TableCell>
                                <p>
                                  {transaction.value} ETH ={" "}
                                  {(
                                    parseFloat(transaction.value) * 0.2
                                  ).toFixed(3)}{" "}
                                  $
                                </p>
                              </TableCell>
                            </TableRow>
                          ))} */}
                        </TableBody>
                      </Table>
                    </div>
                  </div>

                  <div className="h-full w-full">
                    <h3 className="text-2xl font-medium text-neutral my-10">
                      Details
                    </h3>

                    <div className="w-2/2">
                      <div className="flex items-center my-2  space-x-4">
                        <img
                          className="w-8 h-8"
                          src="https://upload.wikimedia.org/wikipedia/commons/b/b7/ETHEREUM-YOUTUBE-PROFILE-PIC.png"
                        />
                        <p className="font-medium"> Ethereum (ERC-1155) </p>
                      </div>

                      <div className="flex items-center my-2 space-x-4">
                        <svg
                          className="w-8 h-8"
                          viewBox="0 0 24 24"
                          fill="none"
                          width="24"
                          height="24"
                          xmlns="http://www.w3.org/2000/svg"
                        >
                          <g clipPath="url(#clip0_989_1157)">
                            <path
                              d="M7.1792 11.6071C7.1792 11.515 7.19742 11.4237 7.23281 11.3386C7.2682 11.2535 7.32007 11.1763 7.38542 11.1113C7.45078 11.0463 7.52834 10.9948 7.61364 10.9599C7.69895 10.925 7.79031 10.9073 7.88248 10.9078L9.04701 10.911C9.13902 10.911 9.23013 10.9291 9.31512 10.9643C9.40012 10.9996 9.47733 11.0512 9.54236 11.1163C9.60738 11.1814 9.65894 11.2587 9.69408 11.3437C9.72922 11.4287 9.74725 11.5198 9.74715 11.6118V16.0174C9.87837 15.9781 10.0465 15.9372 10.2312 15.894C10.3591 15.8638 10.4731 15.7912 10.5547 15.6881C10.6363 15.585 10.6806 15.4574 10.6807 15.3259V9.86048C10.6807 9.6746 10.7545 9.49633 10.886 9.36489C11.0174 9.23346 11.1957 9.15962 11.3816 9.15962H12.5485C12.6405 9.15962 12.7316 9.17775 12.8166 9.21298C12.9016 9.24821 12.9788 9.29985 13.0438 9.36494C13.1088 9.43003 13.1604 9.5073 13.1955 9.59233C13.2307 9.67736 13.2487 9.76848 13.2486 9.86048V14.9331C13.2486 14.9331 13.5409 14.8152 13.8254 14.6942C13.9311 14.6495 14.0214 14.5745 14.0848 14.4788C14.1482 14.3831 14.1821 14.2708 14.1821 14.156V8.10911C14.1821 8.01711 14.2002 7.92601 14.2355 7.84102C14.2707 7.75603 14.3224 7.67882 14.3875 7.6138C14.4526 7.54878 14.5298 7.49723 14.6149 7.4621C14.6999 7.42696 14.791 7.40893 14.883 7.40903H16.0499C16.2356 7.40903 16.4137 7.48279 16.545 7.61408C16.6763 7.74537 16.7501 7.92344 16.7501 8.10911V13.0882C17.7621 12.3551 18.7876 11.4728 19.6009 10.4121C19.7192 10.258 19.7975 10.0771 19.8287 9.88538C19.86 9.6937 19.8433 9.49726 19.78 9.31362C19.2294 7.70882 18.1966 6.3132 16.8228 5.3175C15.4489 4.32181 13.8011 3.77462 12.1045 3.75072C7.53045 3.69022 3.75004 7.42553 3.75004 12.0016C3.74561 13.4495 4.12346 14.873 4.84542 16.1282C4.94499 16.2998 5.09149 16.4395 5.26771 16.5308C5.44393 16.6221 5.64254 16.6613 5.84023 16.6436C6.06024 16.6247 6.33527 16.5964 6.66216 16.5587C6.80455 16.5427 6.93606 16.4748 7.03157 16.368C7.12709 16.2612 7.17992 16.1229 7.17999 15.9797V11.6071H7.1792ZM7.15406 18.6723C8.42322 19.5956 9.92955 20.1375 11.4961 20.2343C13.0626 20.3311 14.6242 19.9789 15.9974 19.2189C17.3706 18.459 18.4984 17.3229 19.2482 15.9442C19.998 14.5655 20.3387 13.0015 20.2303 11.4358C17.2176 15.9309 11.6535 18.0327 7.15484 18.6723"
                              fill="currentColor"
                            ></path>
                          </g>
                          <defs>
                            <clipPath id="clip0_989_1157">
                              <rect
                                width="16.5"
                                height="16.5"
                                fill="white"
                                transform="translate(3.75 3.75)"
                              ></rect>
                            </clipPath>
                          </defs>
                        </svg>
                        <a
                          href={`https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTmhZrL1E23KqqeL7bT24fbLqASfw81VGpj2PpUdzF9MA&s`}
                          className="font-medium"
                        >
                          {" "}
                          View on Etherscan{" "}
                        </a>
                        <svg
                          className="w-3 h-3"
                          viewBox="0 0 10 10"
                          fill="none"
                          width="10"
                          height="10"
                          xmlns="http://www.w3.org/2000/svg"
                        >
                          <path
                            fillRule="evenodd"
                            clipRule="evenodd"
                            d="M9 0.250061H1C0.585786 0.250061 0.25 0.585847 0.25 1.00006C0.25 1.41427 0.585786 1.75006 1 1.75006H7.18934L0.46967 8.46973C0.176777 8.76262 0.176777 9.2375 0.46967 9.53039C0.762563 9.82328 1.23744 9.82328 1.53033 9.53039L8.25 2.81072V9.00006C8.25 9.41428 8.58579 9.75006 9 9.75006C9.41421 9.75006 9.75 9.41428 9.75 9.00006V1.00006C9.75 0.808119 9.67678 0.616178 9.53033 0.469731C9.45842 0.397824 9.37555 0.34357 9.28709 0.30697C9.19866 0.2703 9.10169 0.250061 9 0.250061Z"
                            fill="currentColor"
                          ></path>
                        </svg>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right */}
              <div className="h-154 w-2/5 p-2"></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
